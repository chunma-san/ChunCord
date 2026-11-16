import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function patch(file, marker) {
    const text = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    let result;
    function visit(node) {
        if (ts.isObjectLiteralExpression(node)) {
            const fields = new Map(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(ast), p.initializer]));
            const match = fields.get('match');
            if (match && ts.isRegularExpressionLiteral(match) && match.getText(ast).includes(marker)) {
                const regex = vm.runInNewContext(match.getText(ast));
                result = { match: new RegExp(regex.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)')), replace: fields.get('replace').text.replaceAll('$self', 'plugin') };
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    assert(result, file);
    return result;
}
const voice = patch('src/testcordplugins/VoiceFakeDetector/index.tsx', 'getName');
for (const suffix of ['', ',timer(user.id)']) {
    const input = `children:[names.getName(user),guest?render("span",{children:["guest"]}):""${suffix}]`;
    const output = input.replace(voice.match, voice.replace);
    assert(output.includes('plugin.renderVoiceRow(user?.id)'));
    assert(output.endsWith(`${suffix}]`));
    new Function(`return ({${output}})`);
}
const quality = patch('src/illegalcordplugins/betterScreenshare.desktop/index.tsx', 'goliveMaxQuality');
for (const expression of ['this.getDefaultGoliveQuality()', 'other.patch(this.getDefaultGoliveQuality())']) {
    const output = `this.goliveMaxQuality=${expression},this.lastGoLivePixelCount={}`.replace(quality.match, quality.replace);
    assert.equal(output, `this.goliveMaxQuality=plugin.patchStreamQuality(${expression}),this.lastGoLivePixelCount={}`);
    new Function(output);
}
const owner = patch('src/testcordplugins/vcOwnerDetector/index.tsx', 'getName');
const row = 'className:cls()(base,styles.name,extra,{[styles.speaking]:talking}),children:[alias??names.getName(user),guest]';
const patched = row.replace(owner.match, owner.replace);
assert(patched.includes('plugin.addOwnerClass(cls()(base,styles.name,extra,{[styles.speaking]:talking}),user?.id)'));
new Function(`return ({${patched}})`);
const staffRow = row.replace('names.getName(user)', 'Vencord.Plugins.plugins["StaffDetector"].renderVoiceName(names.getName(user),user)');
const staffPatched = staffRow.replace(owner.match, owner.replace);
assert(staffPatched.includes('plugin.addOwnerClass('));
new Function(`return ({${staffPatched}})`);
const quest = patch('src/equicordplugins/questify/index.tsx', 'onMouseEnter');
for (const extra of ['', ',conditionalClass']) {
    const tile = `className:cls()(styles.tile,extra${extra}),onMouseEnter:enter`;
    assert.equal(tile.replace(quest.match, quest.replace), `className:plugin.getQuestTileClasses(cls()(styles.tile,extra${extra}),arguments[0].quest),style:plugin.getQuestTileStyle(arguments[0].quest),onMouseEnter:enter`);
}
console.log('Voice rows preserve other plugins; quality wrappers compose; VC owner styling receives the row user.');
