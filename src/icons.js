import boxes from '@fluentui/svg-icons/icons/cube_multiple_20_regular.svg?raw';
import download from '@fluentui/svg-icons/icons/arrow_download_20_regular.svg?raw';
import chevron from '@fluentui/svg-icons/icons/chevron_down_20_regular.svg?raw';
import orbit from '@fluentui/svg-icons/icons/rotate_left_20_regular.svg?raw';
import zap from '@fluentui/svg-icons/icons/flash_20_regular.svg?raw';
import box from '@fluentui/svg-icons/icons/cube_20_regular.svg?raw';
import slice from '@fluentui/svg-icons/icons/cut_20_regular.svg?raw';
import fit from '@fluentui/svg-icons/icons/arrow_fit_20_regular.svg?raw';
import ruler from '@fluentui/svg-icons/icons/ruler_20_regular.svg?raw';
import grid from '@fluentui/svg-icons/icons/grid_20_regular.svg?raw';
import layers from '@fluentui/svg-icons/icons/layer_diagonal_20_regular.svg?raw';
import plus from '@fluentui/svg-icons/icons/add_20_regular.svg?raw';
import minus from '@fluentui/svg-icons/icons/subtract_20_regular.svg?raw';
import mouse from '@fluentui/svg-icons/icons/cursor_20_regular.svg?raw';
import file from '@fluentui/svg-icons/icons/document_cube_20_regular.svg?raw';

const glyphs = { boxes, download, chevron, orbit, zap, box, slice, fit, ruler, grid, layers, plus, minus, mouse, file };
export const icons = Object.fromEntries(Object.entries(glyphs).map(([name, svg]) => [
  name, svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" '),
]));
