import { listMediaFiles, listSubfolders } from "./lib";
import { MediaClient } from "./MediaClient";

interface Props {
  searchParams: Promise<{ folder?: string }>;
}

export default async function MediaPage({ searchParams }: Props) {
  const { folder = "" } = await searchParams;
  const subfolders = listSubfolders();
  const files = listMediaFiles(folder || undefined);

  return (
    <div>
      <h1 className="font-cinzel text-3xl tracking-widest uppercase mb-2">Media</h1>
      <p className="text-sm text-[#a89880] mb-8">
        {'Upload images by dragging them onto the drop zone. Click "Copy path" next to any image to get the path for use in content forms.'}
      </p>
      <MediaClient initialFiles={files} subfolders={subfolders} currentSubfolder={folder} />
    </div>
  );
}
