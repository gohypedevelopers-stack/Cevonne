const fs = require('fs');
const path = 'd:\\Dev\\Nextjs Projects\\Cevonne\\components\\admin-dashboard\\G5AssetApprovalPage.tsx';

let content = fs.readFileSync(path, 'utf8');

// Remove AssetInspectorPanelProps
content = content.replace(/type AssetInspectorPanelProps = \{[\s\S]*?\};\n/g, '');

// Remove AssetInspectorPanel
content = content.replace(/const AssetInspectorPanel = \(\{[\s\S]*?\}\);\n/g, '');

fs.writeFileSync(path, content, 'utf8');
