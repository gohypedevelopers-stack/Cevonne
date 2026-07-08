const fs = require('fs');
const path = 'd:\\Dev\\Nextjs Projects\\Cevonne\\components\\admin-dashboard\\G5AssetApprovalPage.tsx';

let content = fs.readFileSync(path, 'utf8');

// Add hiddenAssetIds
content = content.replace(
  /const \[hiddenReviewIds, setHiddenReviewIds\] = useState<Set<string>>\(new Set\(\)\);/,
  'const [hiddenReviewIds, setHiddenReviewIds] = useState<Set<string>>(new Set());\n  const [hiddenAssetIds, setHiddenAssetIds] = useState<Set<string>>(new Set());'
);

// Add handleDeleteAsset function
const handleDeleteAsset = \  const handleDeleteAsset = useCallback((assetId: string) => {
    setHiddenAssetIds(current => {
      const next = new Set(current);
      next.add(assetId);
      return next;
    });
  }, []);\;

content = content.replace(
  /  const handleApprovalDecision = useCallback\(/,
  handleDeleteAsset + '\n\n  const handleApprovalDecision = useCallback('
);

// Filter assets
content = content.replace(
  /const filteredAssets = useMemo\(\(\) => \{[\s\S]*?\}, \[allAssets, search\]\);/,
  \const filteredAssets = useMemo(() => {
    if (!search.trim()) {
      return allAssets.filter(asset => !hiddenAssetIds.has(asset.asset_id));
    }
    const q = search.toLowerCase();
    return allAssets.filter((asset) => {
      if (hiddenAssetIds.has(asset.asset_id)) return false;
      const title = asset.asset_title?.toLowerCase() || "";
      const text = asset.content_text?.toLowerCase() || "";
      return title.includes(q) || text.includes(q);
    });
  }, [allAssets, search, hiddenAssetIds]);\
);

// Pass onDelete to AssetCard instances
content = content.replace(
  /<AssetCard \n                              key=\{asset\.asset_id\} \n                              asset=\{asset\} \n                              onApprove=\{\(id\) => void handleApprovalDecision\("APPROVED", id\)\} \n                              onRunReadinessCheck=\{handleRunReadinessCheck\} \n                              onEdit=\{handleOpenPostEditor\} \n                              busyAction=\{busyAction\} \n                              processingAssetId=\{processingAssetId\} \n                            \/>/g,
  \<AssetCard 
                              key={asset.asset_id} 
                              asset={asset} 
                              onApprove={(id) => void handleApprovalDecision("APPROVED", id)} 
                              onRunReadinessCheck={handleRunReadinessCheck} 
                              onEdit={handleOpenPostEditor} 
                              onDelete={handleDeleteAsset} 
                              busyAction={busyAction} 
                              processingAssetId={processingAssetId} 
                            />\
);

fs.writeFileSync(path, content, 'utf8');
