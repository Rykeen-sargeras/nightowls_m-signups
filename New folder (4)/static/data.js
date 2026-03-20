const CLASS_COLORS = {
    'Warrior': '#C79C6E', 'Paladin': '#F58CBA', 'Hunter': '#ABD473',
    'Rogue': '#FFF569', 'Priest': '#FFFFFF', 'Death Knight': '#C41F3B',
    'Shaman': '#0070DE', 'Mage': '#40C7EB', 'Warlock': '#8787ED',
    'Monk': '#00FF96', 'Druid': '#FF7D0A', 'Demon Hunter': '#A330C9',
    'Evoker': '#33937F',
};
const LUST_CLASSES = new Set(['Shaman', 'Mage', 'Hunter', 'Evoker']);
const BREZ_CLASSES = new Set(['Druid', 'Paladin', 'Warlock', 'Death Knight']);
const ROLE_COLORS = { 'Tank': '#C79C6E', 'Healer': '#F58CBA', 'Melee': '#C41F3B', 'Ranged': '#40C7EB' };
let SPEC_DATA = {};
function hasLust(cls) { return LUST_CLASSES.has(cls); }
function hasBrez(cls) { return BREZ_CLASSES.has(cls); }
