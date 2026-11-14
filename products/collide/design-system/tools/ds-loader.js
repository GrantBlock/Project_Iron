// Resolves the Collide component namespace: compiled bundle if present, else transpiles the source .jsx files.
(function(){
  const FILES = ['display/Icon','display/Kbd','actions/Button','actions/IconButton','forms/Input','forms/Textarea','forms/Checkbox','forms/Switch','forms/Select','display/Badge','display/Chip','display/GlassPanel','navigation/Tabs','navigation/NavItem','feedback/Tooltip','feedback/Toast','feedback/Dialog'];
  const NAMES = ['Icon','Kbd','Button','IconButton','Input','Textarea','Checkbox','Switch','Select','Badge','Chip','GlassPanel','PanelHeader','Tabs','NavItem','NavSection','Tooltip','Toast','Dialog'];
  function findBundle(){ for (const k of Object.keys(window)) { try { const v = window[k]; if (v && typeof v === 'object' && v !== window.__CollideDS && v.Button && v.GlassPanel && v.Icon) return v; } catch(e){} } return null; }
  window.loadCollide = async function(root){
    const b = findBundle(); if (b) return b;
    if (window.__CollideDS) return window.__CollideDS;
    const srcs = await Promise.all(FILES.map(f => fetch(root + 'components/' + f + '.jsx').then(r => r.text())));
    const body = srcs.map(s => s.replace(/^import .*$/gm, '').replace(/^export function/gm, 'function')).join('\n');
    const code = Babel.transform('window.__CollideDS = (function(){' + body + '\nreturn {' + NAMES.join(',') + '};})();', { presets: ['react'] }).code;
    new Function('React', code)(window.React);
    return window.__CollideDS;
  };
})();
