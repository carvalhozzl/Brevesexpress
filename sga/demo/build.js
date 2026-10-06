// Gera demo/sga-demo.html: a interface real (public/) + backend simulado (mock-backend.js)
// num único arquivo, para abrir sem instalar MySQL nem Node.  Uso: node demo/build.js
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');

const css = ler('public/style.css') + `
.aviso-demo { font-size: 12px; line-height: 1.5; color: var(--alerta); background: var(--alerta-fundo); border-radius: 8px; padding: 8px 10px; margin: 0; }
.topo .aviso-demo { flex-basis: 100%; }
`;
let corpo = ler('public/index.html');
corpo = corpo.slice(corpo.indexOf('<body>') + 6, corpo.indexOf('<script src="app.js">'));
const aviso = '<p class="aviso-demo">Demonstração: os dados ficam só neste navegador e voltam ao estado inicial quando a página é recarregada. A versão de entrega usa MySQL.</p>';
corpo = corpo.replace('<button type="submit" class="btn primario">Acessar</button>', '<button type="submit" class="btn primario">Acessar</button>\n    ' + aviso);
corpo = corpo.replace('<div id="acoes-topo"></div>', '<div id="acoes-topo"></div>\n      ' + aviso);

let app = ler('public/app.js');
app = app.replace('async function api(metodo, url, corpo) {', 'async function apiHttp(metodo, url, corpo) {');
app = app.replace(`\n      <button class="btn" id="btn-imprimir">Imprimir</button>`, '');
app = app.replace(`  $('#btn-imprimir').onclick = () => window.print();\n`, '');
if (app.includes('window.print') || !app.includes('apiHttp')) throw new Error('Substituição falhou');

const html = `<title>SGA Faculdade do Bug Infinito</title>
<style>
${css}
</style>
${corpo}
<script>
${ler('demo/mock-backend.js')}
</script>
<script>
${app}
</script>
`;
fs.writeFileSync(path.join(__dirname, 'sga-demo.html'), html);
console.log('demo/sga-demo.html gerado:', html.length, 'bytes');
