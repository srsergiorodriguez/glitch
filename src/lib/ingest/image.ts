export type SourceBytes = { data: Uint8Array; type: string; name: string };

export async function fileToBytes(file: File): Promise<SourceBytes> {
  const buffer = await file.arrayBuffer();
  return {
    data: new Uint8Array(buffer),
    type: file.type || guessType(file.name),
    name: file.name,
  };
}

export async function urlToBytes(url: string): Promise<SourceBytes> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
  const blob = await response.blob();
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    type: blob.type || guessType(url),
    name: url.split('/').pop() ?? 'imagen',
  };
}

function guessType(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'gif') return 'image/gif';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export function extensionFor(type: string): string {
  if (type === 'image/gif') return 'gif';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}
