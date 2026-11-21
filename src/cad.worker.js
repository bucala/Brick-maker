import init from 'replicad-opencascadejs';
import wasm from 'replicad-opencascadejs/wasm?url';
import { setOC } from 'replicad';
import { makeBrick } from './model.js';
import { to3MF } from './export.js';

const kernel = init({ locateFile: () => wasm }).then(oc => {
  setOC(oc);
  return oc;
});
const fineMesh = { tolerance: 0.025, angularTolerance: 0.18 };
let cached;

self.onmessage = async ({ data }) => {
  const { id, params, quality, format } = data;
  try {
    const oc = await kernel;
    const detailed = Boolean(format) || quality !== 'quick';
    const signature = JSON.stringify([params, detailed]);
    if (cached?.signature !== signature) {
      const shape = makeBrick(params, detailed);
      const checker = new oc.BRepCheck_Analyzer(shape.wrapped);
      const valid = checker.IsValid();
      checker.delete();
      if (!valid) {
        shape.delete();
        throw new Error('CAD jadro vytvorilo neplatnú geometriu. Skús upraviť kombináciu parametrov.');
      }
      cached?.shape.delete();
      cached = { signature, shape };
    }
    const { shape } = cached;

    if (format) {
      const exports = {
        stl: () => shape.blobSTL({ ...fineMesh, binary: true }),
        step: () => shape.blobSTEP(),
        '3mf': () => to3MF(shape.mesh(fineMesh)),
      };
      self.postMessage({ id, format, blob: exports[format]() });
      return;
    }

    const meshOptions = detailed ? fineMesh : { tolerance: 0.12, angularTolerance: 0.45 };
    const { vertices, normals, triangles } = shape.mesh(meshOptions);
    const positions = Float32Array.from(vertices);
    const directions = Float32Array.from(normals);
    const indices = Uint32Array.from(triangles);
    const box = shape.boundingBox;
    const limits = box.bounds;
    box.delete();
    self.postMessage({ id, positions, directions, indices, limits }, [positions.buffer, directions.buffer, indices.buffer]);
  } catch (error) {
    self.postMessage({ id, format, error: error instanceof Error ? error.message : 'CAD jadro nedokázalo spracovať tento tvar.' });
  }
};
