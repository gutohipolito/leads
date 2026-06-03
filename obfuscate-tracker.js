const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'src', 'tracker-source.js');
const outputPath = path.join(__dirname, 'public', 'tracker.js');

if (!fs.existsSync(sourcePath)) {
  console.error('Erro: Arquivo fonte src/tracker-source.js não encontrado.');
  process.exit(1);
}

let code = fs.readFileSync(sourcePath, 'utf8');

// 1. Remover Comentários de bloco e linha de forma segura
code = code.replace(/\/\*[\s\S]*?\*\//g, ''); // bloco /* */
code = code.replace(/(?:^|[^:])\/\/.*$/gm, ''); // linha // (exceto http://)

// 2. Ofuscação básica de variáveis de escopo local (substituição controlada)
const replacements = [
  { from: 'config', to: '_cfg' },
  { from: 'startTime', to: '_st' },
  { from: 'maxScroll', to: '_ms' },
  { from: 'getUtms', to: '_gu' },
  { from: 'urlParams', to: '_up' },
  { from: 'utms', to: '_ut' },
  { from: 'ref', to: '_rf' },
  { from: 'getDeviceContext', to: '_gd' },
  { from: 'isWhatsAppLink', to: '_iw' },
  { from: 'lowerUrl', to: '_lu' },
  { from: 'extractWhatsAppPhone', to: '_ew' },
  { from: 'destPhone', to: '_dp' },
  { from: 'wameMatch', to: '_wm' },
  { from: 'phoneMatch', to: '_pm' },
  { from: 'getTrackingMatch', to: '_gt' },
  { from: 'keyword', to: '_kw' },
  { from: 'selector', to: '_sl' },
  { from: 'link', to: '_lk' },
  { from: 'trackLead', to: '_tl' },
  { from: 'trackerMatch', to: '_tm' },
  { from: 'payload', to: '_pl' },
  { from: 'endpoint', to: '_ep' },
  { from: 'blob', to: '_bb' },
  { from: 'getSessionId', to: '_gi' },
  { from: 'parseUtmsFromUrl', to: '_pu' },
  { from: 'isFlushing', to: '_if' },
  { from: 'mergedQueue', to: '_mq' },
  { from: 'currentQueue', to: '_cq' },
  { from: 'lockKey', to: '_lky' },
  { from: 'lock', to: '_lc' },
  { from: 'sanitizeButtonText', to: '_sb' },
  { from: 'beaconPayload', to: '_bp' },
  { from: 'asthrosChannel', to: '_ac' },
  { from: 'flushSafetyTimeout', to: '_ft' },
  { from: 'myTabId', to: '_mt' },
  { from: 'existingLock', to: '_el' },
  { from: 'lockValue', to: '_lv' },
  { from: 'currentLock', to: '_cl' },
  { from: 'finalLock', to: '_fl' }
];

replacements.forEach(r => {
  // Regex com word boundary para evitar substituir partes de outras variáveis (ex: 'url' dentro de 'urlParams')
  const regex = new RegExp(`\\b${r.from}\\b`, 'g');
  code = code.replace(regex, r.to);
});

// 3. Minificação: remover espaços desnecessários, quebras de linha e tabulações
code = code
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0)
  .join(' ');

// Remover espaços ao redor de operadores e caracteres estruturais comum em JS
code = code
  .replace(/\s*([\+\-\*\/=\{\}\(\)\[\]\,\;\:\!\>\<\&\|])\s*/g, '$1')
  // Garantir espaço correto após palavras-chave como const, let, var, function, return, async, case
  .replace(/\b(const|let|var|function|return|async|case)\b\s*/g, '$1 ')
  .trim();

// 4. Adicionar a diretiva sourceURL no final
code += '\n//# sourceURL=QXN0aHJvcyBMZWFkcw==';

fs.writeFileSync(outputPath, code, 'utf8');
console.log('Tracker ofuscado e minificado com sucesso em public/tracker.js');
