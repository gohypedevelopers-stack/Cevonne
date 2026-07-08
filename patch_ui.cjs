const fs = require('fs');
const path = 'd:\\Dev\\Nextjs Projects\\Cevonne\\components\\admin-dashboard\\G5AssetApprovalPage.tsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Add Icons
content = content.replace(/ImagePlus,\n\} from "lucide-react";/, 'ImagePlus,\n    Instagram,\n    Trash2,\n} from "lucide-react";');

// 2. Update AssetCardProps
content = content.replace(
  /onEdit: \(assetId: string\) => void;/g,
  'onEdit: (assetId: string) => void;\n  onDelete?: (assetId: string) => void;'
);

// 3. Update AssetCard Definition
content = content.replace(
  /const AssetCard = \(\{ asset, onApprove, onRunReadinessCheck, onEdit, busyAction, processingAssetId \}: AssetCardProps\) => \{/g,
  'const AssetCard = ({ asset, onApprove, onRunReadinessCheck, onEdit, onDelete, busyAction, processingAssetId }: AssetCardProps) => {'
);

// 4. Update the image section
content = content.replace(
  /        \{syntheticMediaUrl \? \([\s\S]*?pointer-events-none" \/>\n          <\/div>\n        \) : \([\s\S]*?No media<\/span>\n          <\/div>\n        \)}/,
  \        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/30 group-hover:opacity-95 transition-opacity">
          {syntheticMediaUrl ? (
            syntheticMediaUrl.match(/\\.(mp4|mov)$/i) ? (
              <video src={syntheticMediaUrl} className="h-full w-full object-cover" controls playsInline />
            ) : (
              <img src={syntheticMediaUrl} alt={getAssetTitle(asset)} className="h-full w-full object-cover" />
            )
          ) : (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
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
                className="size-7 rounded-full bg-red-500/80 hover:bg-red-500 backdrop-blur-md shadow-sm"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(asset.asset_id); }}
              >
                <Trash2 className="size-3.5 text-white" />
              </Button>
            </div>
          )}
        </div>\
);

// 5. Update badges and remove old platform badge
content = content.replace(
  /<div className="flex flex-wrap items-center justify-between gap-2">\n             <Badge variant="outline" className="rounded-full border-border\/70 bg-white px-2\.5 py-1 text-\[10px\] font-semibold uppercase tracking-\[0\.22em\] shadow-none text-muted-foreground">\n               \{getPlatformDisplayLabel\(asset\)\}\n             <\/Badge>\n             <div className="flex items-center gap-1\.5">\n               <AssetStatusBadge status=\{statusInfo\.label\} \/>\n               <AssetReadinessBadge status=\{readinessInfo\.label\} \/>\n             <\/div>\n          <\/div>/g,
  \<div className="flex items-center gap-1.5 mb-2">
            <AssetStatusBadge status={statusInfo.label} />
            {getFriendlyReadinessLabel(readinessInfo.label) !== getFriendlyStatusLabel(statusInfo.label) && (
              <AssetReadinessBadge status={readinessInfo.label} />
            )}
          </div>\
);

// 6. Remove "Caption:" and "Hook:"
content = content.replace(
  /<span>Caption:<\/span>/g,
  ''
);

content = content.replace(
  /<span>Hook:<\/span>/g,
  ''
);

fs.writeFileSync(path, content, 'utf8');
