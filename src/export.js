import { strToU8, zipSync } from 'fflate';

const modelType = 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml';
const modelPath = '3D/3dmodel.model';
const declaration = '<?xml version="1.0" encoding="UTF-8"?>';

export function to3MF({ vertices, triangles }) {
  const unique = new Map();
  const points = [];
  const remap = [];
  for (let i = 0; i < vertices.length; i += 3) {
    const position = vertices.slice(i, i + 3).map(value => Math.round(value * 1e6) / 1e6);
    const key = position.join(',');
    if (!unique.has(key)) {
      unique.set(key, points.length);
      const [x, y, z] = position;
      points.push(`<vertex x="${x}" y="${y}" z="${z}"/>`);
    }
    remap.push(unique.get(key));
  }

  const faces = [];
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = [remap[triangles[i]], remap[triangles[i + 1]], remap[triangles[i + 2]]];
    if (a !== b && a !== c && b !== c) faces.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`);
  }

  const files = {
    '[Content_Types].xml': `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="${modelType}"/></Types>`,
    '_rels/.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/${modelPath}" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
    [modelPath]: `<model unit="millimeter" xml:lang="sk-SK" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model"><mesh><vertices>${points.join('')}</vertices><triangles>${faces.join('')}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`,
  };
  const archive = zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(declaration + xml)])));
  return new Blob([archive], { type: 'model/3mf' });
}
