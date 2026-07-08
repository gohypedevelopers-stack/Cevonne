import re

path = r"d:\Dev\Nextjs Projects\Cevonne\components\admin-dashboard\G5AssetApprovalPage.tsx"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Icons
content = re.sub(
    r'ImagePlus,\n\} from "lucide-react";',
    'ImagePlus,\n  Instagram,\n  Trash2,\n} from "lucide-react";',
    content
)

# 2. Update AssetCardProps
content = re.sub(
    r'onEdit: \(assetId: string\) => void;',
    'onEdit: (assetId: string) => void;\n  onDelete?: (assetId: string) => void;',
    content
)

# 3. Update AssetCard Definition
content = re.sub(
    r'const AssetCard = \(\{ asset, onApprove, onRunReadinessCheck, onEdit, busyAction, processingAssetId \}: AssetCardProps\) => \{',
    'const AssetCard = ({ asset, onApprove, onRunReadinessCheck, onEdit, onDelete, busyAction, processingAssetId }: AssetCardProps) => {',
    content
)

# 4. Update the image section
new_image_section = """        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/30 group-hover:opacity-95 transition-opacity">
          {syntheticMediaUrl ? (
            syntheticMediaUrl.match(/\.(mp4|mov)$/i) ? (
              <video src={syntheticMediaUrl} className="h-full w-full object-cover" controls playsInline />
            ) : (
              <img src={syntheticMediaUrl} alt={getAssetTitle(asset)} className="h-full w-full object-cover" />
            )
          ) : (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50 border-b border-border/50">
               <ImagePlus className="size-8 mb-2 opacity-50" />
               <span className="text-[11px] font-medium uppercase tracking-widest">No media</span>
             </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30 pointer-events-none" />
          
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <Badge variant="outline" className="rounded-full border-white/20 bg-black/40 backdrop-blur-md px-2.5 py-1 text-white shadow-sm flex items-center gap-1.5">
              <Instagram className="size-3.5" />
              {getPlatformDisplayLabel(asset) !== "Instagram" && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] mt-[1px]">{getPlatformDisplayLabel(asset)}</span>
              )}
            </Badge>
          </div>

          {onDelete && (
            <div className="absolute top-3 right-3 z-10">
              <Button 
                type="button" 
                variant="destructive" 
                size="icon" 
                className="size-7 rounded-full bg-red-500/80 hover:bg-red-500 backdrop-blur-md shadow-sm border border-red-500/20"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(asset.asset_id); }}
              >
                <Trash2 className="size-3.5 text-white" />
              </Button>
            </div>
          )}
        </div>"""
        
content = re.sub(
    r'        \{syntheticMediaUrl \? \([\s\S]*?pointer-events-none" \/>\n          <\/div>\n        \) : \([\s\S]*?No media<\/span>\n          <\/div>\n        \)}',
    new_image_section,
    content
)

# 5. Update badges and remove old platform badge
new_badges = """<div className="flex items-center gap-1.5 mb-2">
             <AssetStatusBadge status={statusInfo.label} />
             {getFriendlyReadinessLabel(readinessInfo.label) !== getFriendlyStatusLabel(statusInfo.label) && (
               <AssetReadinessBadge status={readinessInfo.label} />
             )}
          </div>"""
content = re.sub(
    r'<div className="flex flex-wrap items-center justify-between gap-2">\n             <Badge variant="outline" className="rounded-full border-border/70 bg-white px-2.5 py-1 text-\[10px\] font-semibold uppercase tracking-\[0.22em\] shadow-none text-muted-foreground">\n               \{getPlatformDisplayLabel\(asset\)\}\n             <\/Badge>\n             <div className="flex items-center gap-1.5">\n               <AssetStatusBadge status=\{statusInfo.label\} \/>\n               <AssetReadinessBadge status=\{readinessInfo.label\} \/>\n             <\/div>\n          <\/div>',
    new_badges,
    content
)

# 6. Remove "Caption:" and "Hook:"
content = content.replace('<span>Caption:</span>', '')
content = content.replace('<span>Hook:</span>', '')

# 7. Add hiddenAssetIds state
content = content.replace(
    'const [hiddenReviewIds, setHiddenReviewIds] = useState<Set<string>>(new Set());',
    'const [hiddenReviewIds, setHiddenReviewIds] = useState<Set<string>>(new Set());\n  const [hiddenAssetIds, setHiddenAssetIds] = useState<Set<string>>(new Set());'
)

# 8. Add handleDeleteAsset function
delete_func = """  const handleDeleteAsset = useCallback((assetId: string) => {
    setHiddenAssetIds(current => {
      const next = new Set(current);
      next.add(assetId);
      return next;
    });
  }, []);

  const handleApprovalDecision = useCallback("""
  
content = content.replace('  const handleApprovalDecision = useCallback(', delete_func)

# 9. Filter out hidden assets
content = content.replace(
    'asset.client_tab === "pending_approval"',
    'asset.client_tab === "pending_approval" && !hiddenAssetIds.has(asset.asset_id)'
)
content = content.replace(
    'asset.client_tab === "ready_to_publish"',
    'asset.client_tab === "ready_to_publish" && !hiddenAssetIds.has(asset.asset_id)'
)
content = content.replace(
    'asset.client_tab === "published_manually"',
    'asset.client_tab === "published_manually" && !hiddenAssetIds.has(asset.asset_id)'
)
content = content.replace(
    'asset.client_tab === "blocked"',
    'asset.client_tab === "blocked" && !hiddenAssetIds.has(asset.asset_id)'
)
content = content.replace(
    'asset.client_tab !== "pending_approval"',
    '(asset.client_tab !== "pending_approval" || hiddenAssetIds.has(asset.asset_id))'
)
content = content.replace(
    'asset.client_tab !== "ready_to_publish"',
    '(asset.client_tab !== "ready_to_publish" || hiddenAssetIds.has(asset.asset_id))'
)
content = content.replace(
    'asset.client_tab !== "published_manually"',
    '(asset.client_tab !== "published_manually" || hiddenAssetIds.has(asset.asset_id))'
)
content = content.replace(
    'asset.client_tab !== "blocked"',
    '(asset.client_tab !== "blocked" || hiddenAssetIds.has(asset.asset_id))'
)
content = content.replace(
    '], [allAssets, searchQuery]);',
    '], [allAssets, searchQuery, hiddenAssetIds]);'
)

# 10. Pass onDelete to AssetCard instances
card_replace = """<AssetCard 
                              key={asset.asset_id} 
                              asset={asset} 
                              onApprove={(id) => void handleApprovalDecision("APPROVED", id)} 
                              onRunReadinessCheck={handleRunReadinessCheck} 
                              onEdit={handleOpenPostEditor} 
                              onDelete={handleDeleteAsset} 
                              busyAction={busyAction} 
                              processingAssetId={processingAssetId} 
                            />"""
                            
content = re.sub(
    r'<AssetCard \s*key=\{asset\.asset_id\} \s*asset=\{asset\} \s*onApprove=\{\(id\) => void handleApprovalDecision\("APPROVED", id\)\} \s*onRunReadinessCheck=\{handleRunReadinessCheck\} \s*onEdit=\{handleOpenPostEditor\} \s*busyAction=\{busyAction\} \s*processingAssetId=\{processingAssetId\} \s*\/>',
    card_replace,
    content
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
