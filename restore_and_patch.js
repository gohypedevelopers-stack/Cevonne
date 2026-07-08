const fs = require('fs');
const path = 'd:\\\\Dev\\\\Nextjs Projects\\\\Cevonne\\\\components\\\\admin-dashboard\\\\G5AssetApprovalPage.tsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Remove AssetInspectorPanelProps
content = content.replace(/type AssetInspectorPanelProps = \{[\s\S]*?\};\n/g, '');

// 2. Remove AssetInspectorPanel component
content = content.replace(/const AssetInspectorPanel = \(\{[\s\S]*?\};\n\nexport default function/g, 'export default function');

// 3. Remove split layout
content = content.replace(
  /className=\{cn\(\n\s*"grid items-start gap-4 lg:gap-6",\n\s*activeTab === "approved-content"\n\s*\? "xl:grid-cols-1"\n\s*: "xl:grid-cols-\[minmax\(0,1\.55fr\)_minmax\(360px,0\.85fr\)\]"\n\s*\)\}/g,
  'className={cn("grid items-start gap-4 lg:gap-6 xl:grid-cols-1")}'
);

// 4. Remove AssetInspectorPanel usage and Sheet
content = content.replace(
  /\{activeTab !== "approved-content" && \([\s\S]*?<\/Sheet>/g,
  ''
);

// 5. Update AssetCardProps
content = content.replace(
  /type AssetCardProps = \{[\s\S]*?\};/g,
  \	ype AssetCardProps = {
  asset: G5DashboardAssetRecord;
  onApprove: (assetId: string) => void;
  onRunReadinessCheck: (assetId: string) => void;
  onEdit: (assetId: string) => void;
  onDelete?: (assetId: string) => void;
  busyAction: BusyAction;
  processingAssetId: string | null;
};\
);

// 6. Update AssetCard
const newAssetCard = \const AssetCard = ({ asset, onApprove, onRunReadinessCheck, onEdit, onDelete, busyAction, processingAssetId }: AssetCardProps) => {
  const statusInfo = getAssetStatusInfo(asset);
  const readinessInfo = getReadinessInfo(asset);
  
  const captionText = (asset.content_text?.trim() || asset.asset_title?.trim() || "").trim();
  const hookText = (asset.hook_angle?.trim() || "").trim();
  
  const syntheticMediaUrl = asset.media_url?.trim() || asset.storage_url?.trim() || null;
  const isApproved = isAssetApproved(asset);
  const approvalComplete = Boolean(isAssetApproved(asset) || asset.published_at);
  
  const isBusy = processingAssetId === asset.asset_id;

  return (
    <article className="group flex h-full w-full flex-col overflow-hidden rounded-[20px] border border-border/60 bg-white shadow-sm transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
      <div className="relative flex flex-1 flex-col overflow-hidden border-b border-border/60 bg-white">
        
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/30 group-hover:opacity-95 transition-opacity">
          {syntheticMediaUrl ? (
            syntheticMediaUrl.match(/\\.(mp4|mov)$/i) ? (
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
        </div>

        <div className="relative flex flex-1 flex-col space-y-3 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-1.5 mb-2">
             <AssetStatusBadge status={statusInfo.label} />
             {getFriendlyReadinessLabel(readinessInfo.label) !== getFriendlyStatusLabel(statusInfo.label) && (
               <AssetReadinessBadge status={readinessInfo.label} />
             )}
          </div>

          <div className="flex-1">
            <p className="line-clamp-2 font-serif text-[clamp(1.05rem,1.15vw,1.25rem)] leading-[1.2] tracking-tight text-primary text-pretty">
              {getAssetTitle(asset)}
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <div className="flex min-w-0 items-start gap-2 text-[10px] leading-5">
              <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <MessageCircle className="size-3 shrink-0 text-violet-600" aria-hidden="true" />
              </span>
              <p className="min-w-0 flex-1 line-clamp-2 text-xs leading-5 text-slate-600 text-pretty">
                {captionText || "No caption available."}
              </p>
            </div>
            
            <div className="flex min-w-0 items-start gap-2 text-[10px] leading-5">
              <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <FileUp className="size-3 shrink-0 text-amber-600" aria-hidden="true" />
              </span>
              <p className="min-w-0 flex-1 line-clamp-2 text-xs leading-5 text-slate-600 text-pretty">
                {hookText || "No hook available."}
              </p>
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onEdit(asset.asset_id)}
              className="h-9 w-full rounded-[12px] px-4 text-xs shadow-none"
            >
              <PencilLine className="mr-2 size-3.5" />
              Edit post details
            </Button>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={() => onRunReadinessCheck(asset.asset_id)}
                disabled={isBusy && busyAction === "readiness"}
                variant="outline"
                className="h-9 rounded-[12px] px-2 text-xs shadow-none"
              >
                {isBusy && busyAction === "readiness" ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Clock3 className="mr-1.5 size-3.5" />}
                Readiness check
              </Button>
              
              <Button
                type="button"
                onClick={() => onApprove(asset.asset_id)}
                disabled={(isBusy && busyAction === "approve") || approvalComplete}
                variant={isApproved ? "secondary" : "default"}
                className={cn("h-9 rounded-[12px] px-2 text-xs shadow-none transition-colors", !isApproved && "bg-violet-600 hover:bg-violet-700")}
              >
                {isBusy && busyAction === "approve" ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-3.5" />}
                {isApproved ? "Approved" : "Approve"}
              </Button>
            </div>
          </div>
          
        </div>
      </div>
    </article>
  );
};\n;

content = content.replace(/const AssetCard = \(\{[\s\S]*?<\/article>\n  \);\n\};\n/g, newAssetCard);

// 7. Update Map iterators to pass handlers correctly
const targetMap = \<AssetCard 
                              key={asset.asset_id} 
                              asset={asset} 
                              onApprove={(id) => void handleApprovalDecision("APPROVED", id)} 
                              onRunReadinessCheck={handleRunReadinessCheck} 
                              onEdit={handleOpenPostEditor} 
                              onDelete={handleDeleteAsset}
                              busyAction={busyAction} 
                              processingAssetId={processingAssetId} 
                            />\;

// We have multiple asset.map calls, we need to replace the inner AssetCard
content = content.replace(
  /<AssetCard\s*key=\{asset\.asset_id\}\s*asset=\{asset\}\s*selected=\{selectedAssetId === asset\.asset_id\}\s*onSelect=\{setSelectedAssetId\}\s*\/>/g,
  targetMap
);
content = content.replace(
  /<AssetCard \s*key=\{asset\.asset_id\} \s*asset=\{asset\} \s*onApprove=\{\(id\) => void handleApprovalDecision\("APPROVED", id\)\} \s*onRunReadinessCheck=\{handleRunReadinessCheck\} \s*onEdit=\{handleOpenPostEditor\} \s*busyAction=\{busyAction\} \s*processingAssetId=\{processingAssetId\} \s*\/>/g,
  targetMap
);
content = content.replace(
  /<AssetCard \s*key=\{asset\.asset_id\} \s*asset=\{asset\} \s*onApprove=\{\(id\) => void handleApprovalDecision\("APPROVED", id\)\} \s*onRunReadinessCheck=\{handleRunReadinessCheck\} \s*onEdit=\{handleOpenPostEditor\} \s*onDelete=\{handleDeleteAsset\} \s*busyAction=\{busyAction\} \s*processingAssetId=\{processingAssetId\} \s*\/>/g,
  targetMap
);

// 8. Add hiddenAssetIds state
if (!content.includes('hiddenAssetIds')) {
  content = content.replace(
    'const [hiddenReviewIds, setHiddenReviewIds] = useState<Set<string>>(new Set());',
    'const [hiddenReviewIds, setHiddenReviewIds] = useState<Set<string>>(new Set());\n  const [hiddenAssetIds, setHiddenAssetIds] = useState<Set<string>>(new Set());'
  );

  const delete_func = \  const handleDeleteAsset = useCallback((assetId: string) => {
    setHiddenAssetIds(current => {
      const next = new Set(current);
      next.add(assetId);
      return next;
    });
  }, []);

  const handleApprovalDecision = useCallback(\;
  
  content = content.replace('  const handleApprovalDecision = useCallback(', delete_func);

  // Add filter logic
  content = content.replace(
      'asset.client_tab === "pending_approval"',
      'asset.client_tab === "pending_approval" && !hiddenAssetIds.has(asset.asset_id)'
  );
  content = content.replace(
      'asset.client_tab === "ready_to_publish"',
      'asset.client_tab === "ready_to_publish" && !hiddenAssetIds.has(asset.asset_id)'
  );
  content = content.replace(
      'asset.client_tab === "published_manually"',
      'asset.client_tab === "published_manually" && !hiddenAssetIds.has(asset.asset_id)'
  );
  content = content.replace(
      'asset.client_tab === "blocked"',
      'asset.client_tab === "blocked" && !hiddenAssetIds.has(asset.asset_id)'
  );
  content = content.replace(
      'asset.client_tab !== "pending_approval"',
      '(asset.client_tab !== "pending_approval" || hiddenAssetIds.has(asset.asset_id))'
  );
  content = content.replace(
      'asset.client_tab !== "ready_to_publish"',
      '(asset.client_tab !== "ready_to_publish" || hiddenAssetIds.has(asset.asset_id))'
  );
  content = content.replace(
      'asset.client_tab !== "published_manually"',
      '(asset.client_tab !== "published_manually" || hiddenAssetIds.has(asset.asset_id))'
  );
  content = content.replace(
      'asset.client_tab !== "blocked"',
      '(asset.client_tab !== "blocked" || hiddenAssetIds.has(asset.asset_id))'
  );
  content = content.replace(
      /], \[allAssets, searchQuery\]\);/g,
      '], [allAssets, searchQuery, hiddenAssetIds]);'
  );
}

// Ensure icons are imported
if (!content.includes('Instagram,')) {
  content = content.replace(/ImagePlus,/, 'ImagePlus,\n  Instagram,\n  Trash2,');
}

// 9. handleOpenPostEditor fixes (assetToEdit)
if (content.includes('getPrimaryCaption(assetToEdit)')) {
  content = content.replace(
    'const caption = getPrimaryCaption(assetToEdit).trim();',
    'const caption = (assetEdits[assetToEdit.asset_id]?.caption?.trim() || assetToEdit.content_text?.trim() || assetToEdit.asset_title?.trim() || "").trim();'
  );
  content = content.replace(
    'const hook = getPrimaryHook(assetToEdit).trim();',
    'const hook = (assetEdits[assetToEdit.asset_id]?.hook?.trim() || assetToEdit.hook_angle?.trim() || "").trim();'
  );
}

content = content.replace(
  /approvalId: selectedAsset\.approval_id\?\.trim\(\) \|\| selectedAsset\.asset_id,/g,
  'approvalId: assetToEdit.approval_id?.trim() || assetToEdit.asset_id,'
);
content = content.replace(
  /title: selectedAsset\.asset_title\?\.trim\(\) \|\| selectedAsset\.content_text\?\.trim\(\) \|\| "",/g,
  'title: assetToEdit.asset_title?.trim() || assetToEdit.content_text?.trim() || "",'
);
content = content.replace(
  /platform: selectedAsset\.platform\?\.trim\(\) \|\| selectedAsset\.intended_platform\?\.trim\(\) \|\| "",/g,
  'platform: assetToEdit.platform?.trim() || assetToEdit.intended_platform?.trim() || "",'
);
content = content.replace(
  /sourceUrl: selectedAsset\.post_url\?\.trim\(\) \|\| "",/g,
  'sourceUrl: assetToEdit.post_url?.trim() || "",'
);

content = content.replace(
  /const placeholder = createAssetComposerDraftPlaceholder\(selectedAsset, caption, hook\);/,
  'const placeholder = createAssetComposerDraftPlaceholder(match, caption, hook);'
);
content = content.replace(
  /const placeholder = createAssetComposerDraftPlaceholder\(assetToEdit, caption, hook\);/,
  'const placeholder = createAssetComposerDraftPlaceholder(match, caption, hook);'
);

// fix dependencies in handleOpenPostEditor
content = content.replace(
  /\}, \[authFetch, selectedAsset, selectedAssetCaptionValue, selectedAssetHookValue, selectedAssetMatchedG4Review\]\);/g,
  '}, [authFetch, selectedAsset, allAssets, assetEdits, selectedAssetMatchedG4Review]);'
);

// 10. handleRunReadinessCheck fixes
if (content.includes('getPrimaryCaption(assetToCheck)')) {
  content = content.replace(
    'caption: getPrimaryCaption(assetToCheck),',
    'caption: (assetEdits[assetToCheck.asset_id]?.caption?.trim() || assetToCheck.content_text?.trim() || assetToCheck.asset_title?.trim() || "").trim(),'
  );
}

fs.writeFileSync(path, content, 'utf8');
