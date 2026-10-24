/* SPDX-License-Identifier: GPL-3.0-or-later */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
let calls=0;
const logs=[];
const history=[];
const factory=()=>{
    calls++;
    if(calls===1)history.push(['proxyLazyWebpack',[factory],'test stack']);
    return {};
};
history.push(['proxyLazyWebpack',[factory],'test stack']);
history.push(['extractAndLoadChunks',[['missing-chunk'],/chunk/],'test stack']);
const sandbox={setTimeout:(callback,delay,...args)=>setTimeout(callback,delay===15000?5:delay,...args),clearTimeout,queueMicrotask,Vencord:{Webpack:{}}};
sandbox.__reporterFixture={
    history,
    logs,
    addPatch(){queueMicrotask(()=>sandbox.Vencord.Webpack._initReporter());}
};
const stubs={
 '@api/PluginManager':'export const addPatch=(...args)=>globalThis.__reporterFixture.addPatch(...args);',
 '@plugins/devCompanion.dev/initWs':'export function initWs(){}',
 '@utils/Logger':'export class Logger { log(...args){globalThis.__reporterFixture.logs.push(args);} warn(){} }',
 '@webpack':'export const wreq=Object.assign(()=>{},{m:{}});export const lazyWebpackSearchHistory=globalThis.__reporterFixture.history;export async function extractAndLoadChunks(){return new Promise(()=>{});}export function mapMangledModule(){return {};}',
 '@webpack/patcher':'export const patches=[];export const patchTimings=[];export const getBuildNumber=()=>0;',
 './loadLazyChunks':'export async function loadLazyChunks(){}',
 './reporterData':'export const reporterData={};'
};
try {
 const consoleModule=await build({entryPoints:['scripts/reporterConsole.ts'],bundle:true,write:false,format:'esm',platform:'node'});
 const {consoleValue,consoleError}=await import('data:text/javascript;base64,'+Buffer.from(consoleModule.outputFiles[0].contents).toString('base64'));
 const handle=remote=>({remoteObject:()=>remote,jsonValue(){throw new Error('Unexpected browser round trip');},getProperty(){throw new Error('Unexpected browser round trip');}});
 assert.equal(consoleValue(handle({type:'string',value:'[Equicord]'})),'[Equicord]');
 assert.equal(consoleValue(handle({type:'number',value:0})),0);
 assert.equal(consoleValue(handle({type:'object',description:'Object'})),'Object');
 assert.equal(consoleError(handle({type:'object',subtype:'error',description:'Error: real failure'})),'Error: real failure');
 const result=await build({entryPoints:['src/debug/runReporter.ts'],bundle:true,write:false,format:'cjs',platform:'node',define:{IS_REPORTER:'true',IS_WEB:'false',IS_VESKTOP:'false',IS_EQUIBOP:'false',IS_COMPANION_TEST:'false'},plugins:[{name:'reporter-fixtures',setup(b){
  b.onResolve({filter:/.*/},args=>Object.hasOwn(stubs,args.path)?{path:args.path,namespace:'fixture'}:undefined);
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path]}));
 }}]});
 vm.runInNewContext(result.outputFiles[0].text,sandbox);
 const deadline=Date.now()+2000;
 while(!logs.some(x=>x[0]==='Finished test')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));
 assert(logs.some(x=>x[0]==='Finished test'),'Reporter must finish');
 assert.equal(calls,1,'Searches registered during replay belong to a later snapshot');
 assert.equal(history.length,3);
 assert(logs.some(x=>x[0]==='Webpack Find Fail:'),'Timed-out chunk lookup must be reported as a failure');
 console.log('Real reporter regression: isolated globals, stable replay, bounded chunk lookup and failure reporting PASS');
} finally {delete sandbox.__reporterFixture;}
