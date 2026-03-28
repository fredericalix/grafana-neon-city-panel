// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

// Override the scaffolded canvas mock with a proper 2D context stub
// so prefabs that use canvas textures (TowerA, TowerB, Pyramid, etc.) can initialize.
const mockContext2D = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  strokeRect: jest.fn(),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  arcTo: jest.fn(),
  rect: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  clip: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  rotate: jest.fn(),
  scale: jest.fn(),
  setTransform: jest.fn(),
  resetTransform: jest.fn(),
  createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  measureText: jest.fn(() => ({ width: 0 })),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  drawImage: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(0) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(),
  setLineDash: jest.fn(),
  getLineDash: jest.fn(() => []),
  roundRect: jest.fn(),
};

HTMLCanvasElement.prototype.getContext = jest.fn(function (type) {
  if (type === '2d') {
    return mockContext2D;
  }
  return null;
});
