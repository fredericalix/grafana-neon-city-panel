import * as THREE from 'three';

/**
 * Retro arcade game animations for Arcade building side panels
 * - Snake game on left side
 * - Space Invaders on right side
 *
 * Style: Pixel art LED with glow effect
 * Reactive to mood (colors) and activity (speed)
 */

// Grid configuration - fills most of the side panel
const GRID_WIDTH = 18;
const GRID_HEIGHT = 30;
const PIXEL_SIZE = 0.09;
const PIXEL_GAP = 0.01;

// ============================================================================
// SNAKE GAME (Left side)
// ============================================================================

interface SnakeSegment {
  x: number;
  y: number;
}

export class SnakeGame {
  private group: THREE.Group;
  private pixelGrid: THREE.InstancedMesh;
  private pixelDummy = new THREE.Object3D();
  private gridState: number[][] = []; // 0 = off, 1 = snake, 2 = apple

  private snake: SnakeSegment[] = [];
  private apple: { x: number; y: number } = { x: 0, y: 0 };
  private direction: 'up' | 'down' | 'left' | 'right' = 'right';
  private moveTimer = 0;
  private moveInterval = 0.15; // seconds between moves

  private primaryColor = 0x00aaff;
  private appleColor = 0xff4444;

  constructor() {
    this.group = new THREE.Group();

    // Initialize grid state
    for (let y = 0; y < GRID_HEIGHT; y++) {
      this.gridState[y] = [];
      for (let x = 0; x < GRID_WIDTH; x++) {
        this.gridState[y][x] = 0;
      }
    }

    // Create instanced mesh for pixels
    const pixelGeo = new THREE.BoxGeometry(PIXEL_SIZE, PIXEL_SIZE, 0.01);
    const pixelMat = new THREE.MeshBasicMaterial({
      color: this.primaryColor,
      transparent: true,
      opacity: 0.9,
    });

    this.pixelGrid = new THREE.InstancedMesh(pixelGeo, pixelMat, GRID_WIDTH * GRID_HEIGHT);
    this.pixelGrid.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Position all pixels (initially invisible via scale)
    this.initializePixelPositions();
    this.group.add(this.pixelGrid);

    // Initialize snake
    this.resetGame();
  }

  private initializePixelPositions(): void {
    const offsetX = -(GRID_WIDTH * (PIXEL_SIZE + PIXEL_GAP)) / 2;
    const offsetY = -(GRID_HEIGHT * (PIXEL_SIZE + PIXEL_GAP)) / 2;

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const idx = y * GRID_WIDTH + x;
        this.pixelDummy.position.set(
          offsetX + x * (PIXEL_SIZE + PIXEL_GAP),
          offsetY + y * (PIXEL_SIZE + PIXEL_GAP),
          0
        );
        this.pixelDummy.scale.set(0, 0, 0); // Initially invisible
        this.pixelDummy.updateMatrix();
        this.pixelGrid.setMatrixAt(idx, this.pixelDummy.matrix);
      }
    }
    this.pixelGrid.instanceMatrix.needsUpdate = true;
  }

  private resetGame(): void {
    // Clear grid
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        this.gridState[y][x] = 0;
      }
    }

    // Initialize snake in center (8 segments for bigger grid)
    this.snake = [];
    const startX = Math.floor(GRID_WIDTH / 2);
    const startY = Math.floor(GRID_HEIGHT / 2);
    for (let i = 0; i < 8; i++) {
      this.snake.push({ x: startX - i, y: startY });
    }

    // Random direction
    const directions: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
    this.direction = directions[Math.floor(Math.random() * directions.length)];

    // Place apple
    this.placeApple();
  }

  private placeApple(): void {
    let x: number, y: number;
    do {
      x = Math.floor(Math.random() * GRID_WIDTH);
      y = Math.floor(Math.random() * GRID_HEIGHT);
    } while (this.isSnakeAt(x, y));

    this.apple = { x, y };
  }

  private isSnakeAt(x: number, y: number): boolean {
    return this.snake.some(seg => seg.x === x && seg.y === y);
  }

  getObject(): THREE.Group {
    return this.group;
  }

  setColor(color: number): void {
    this.primaryColor = color;

    // Update the base material color for InstancedMesh
    if (this.pixelGrid.material instanceof THREE.MeshBasicMaterial) {
      this.pixelGrid.material.color.setHex(color);
    }
    // Apple stays red/orange for visibility
  }

  update(deltaTime: number, activitySpeed: number): void {
    this.moveTimer += deltaTime;

    // Adjust speed based on activity
    const adjustedInterval = this.moveInterval / activitySpeed;

    if (this.moveTimer >= adjustedInterval) {
      this.moveTimer = 0;
      this.moveSnake();
    }

    this.updatePixelGrid();
  }

  private moveSnake(): void {
    const head = this.snake[0];
    let newX = head.x;
    let newY = head.y;

    // Move in current direction
    switch (this.direction) {
      case 'up': newY++; break;
      case 'down': newY--; break;
      case 'left': newX--; break;
      case 'right': newX++; break;
    }

    // Wrap around edges
    if (newX < 0) newX = GRID_WIDTH - 1;
    if (newX >= GRID_WIDTH) newX = 0;
    if (newY < 0) newY = GRID_HEIGHT - 1;
    if (newY >= GRID_HEIGHT) newY = 0;

    // Check self-collision - reset if hit
    if (this.isSnakeAt(newX, newY)) {
      this.resetGame();
      return;
    }

    // Add new head
    this.snake.unshift({ x: newX, y: newY });

    // Check apple
    if (newX === this.apple.x && newY === this.apple.y) {
      // Grow snake (don't remove tail)
      this.placeApple();

      // Change direction randomly sometimes
      if (Math.random() < 0.3) {
        this.changeDirection();
      }
    } else {
      // Remove tail
      this.snake.pop();
    }

    // Randomly change direction occasionally
    if (Math.random() < 0.05) {
      this.changeDirection();
    }
  }

  private changeDirection(): void {
    const head = this.snake[0];
    const directions: Array<'up' | 'down' | 'left' | 'right'> = [];

    // Don't reverse direction
    if (this.direction !== 'down') directions.push('up');
    if (this.direction !== 'up') directions.push('down');
    if (this.direction !== 'right') directions.push('left');
    if (this.direction !== 'left') directions.push('right');

    // Prefer directions that move toward apple
    const toAppleX = this.apple.x - head.x;
    const toAppleY = this.apple.y - head.y;

    if (Math.random() < 0.6) {
      // Move toward apple
      if (Math.abs(toAppleX) > Math.abs(toAppleY)) {
        this.direction = toAppleX > 0 ? 'right' : 'left';
      } else {
        this.direction = toAppleY > 0 ? 'up' : 'down';
      }
    } else {
      // Random direction
      this.direction = directions[Math.floor(Math.random() * directions.length)];
    }
  }

  private updatePixelGrid(): void {
    const offsetX = -(GRID_WIDTH * (PIXEL_SIZE + PIXEL_GAP)) / 2;
    const offsetY = -(GRID_HEIGHT * (PIXEL_SIZE + PIXEL_GAP)) / 2;

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const idx = y * GRID_WIDTH + x;
        const isSnake = this.isSnakeAt(x, y);
        const isApple = x === this.apple.x && y === this.apple.y;

        this.pixelDummy.position.set(
          offsetX + x * (PIXEL_SIZE + PIXEL_GAP),
          offsetY + y * (PIXEL_SIZE + PIXEL_GAP),
          0
        );

        if (isSnake || isApple) {
          this.pixelDummy.scale.set(1, 1, 1);
          // Set color
          const color = isApple ? new THREE.Color(this.appleColor) : new THREE.Color(this.primaryColor);
          this.pixelGrid.setColorAt(idx, color);
        } else {
          this.pixelDummy.scale.set(0, 0, 0);
        }

        this.pixelDummy.updateMatrix();
        this.pixelGrid.setMatrixAt(idx, this.pixelDummy.matrix);
      }
    }

    this.pixelGrid.instanceMatrix.needsUpdate = true;
    if (this.pixelGrid.instanceColor) {
      this.pixelGrid.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    this.pixelGrid.geometry.dispose();
    if (this.pixelGrid.material instanceof THREE.Material) {
      this.pixelGrid.material.dispose();
    }
  }
}

// ============================================================================
// SPACE INVADERS GAME (Right side)
// ============================================================================

interface Alien {
  x: number;
  y: number;
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
  isPlayerBullet: boolean;
}

export class InvadersGame {
  private group: THREE.Group;
  private pixelGrid: THREE.InstancedMesh;
  private pixelDummy = new THREE.Object3D();

  private aliens: Alien[] = [];
  private player: { x: number } = { x: GRID_WIDTH / 2 };
  private bullets: Bullet[] = [];

  private alienDirection: 'left' | 'right' = 'right';
  private moveTimer = 0;
  private moveInterval = 0.2;
  private shootTimer = 0;
  private shootInterval = 0.8;

  private primaryColor = 0x00aaff;

  constructor() {
    this.group = new THREE.Group();

    // Create instanced mesh for pixels
    const pixelGeo = new THREE.BoxGeometry(PIXEL_SIZE, PIXEL_SIZE, 0.01);
    const pixelMat = new THREE.MeshBasicMaterial({
      color: this.primaryColor,
      transparent: true,
      opacity: 0.9,
    });

    this.pixelGrid = new THREE.InstancedMesh(pixelGeo, pixelMat, GRID_WIDTH * GRID_HEIGHT);
    this.pixelGrid.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.initializePixelPositions();
    this.group.add(this.pixelGrid);

    this.resetGame();
  }

  private initializePixelPositions(): void {
    const offsetX = -(GRID_WIDTH * (PIXEL_SIZE + PIXEL_GAP)) / 2;
    const offsetY = -(GRID_HEIGHT * (PIXEL_SIZE + PIXEL_GAP)) / 2;

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const idx = y * GRID_WIDTH + x;
        this.pixelDummy.position.set(
          offsetX + x * (PIXEL_SIZE + PIXEL_GAP),
          offsetY + y * (PIXEL_SIZE + PIXEL_GAP),
          0
        );
        this.pixelDummy.scale.set(0, 0, 0);
        this.pixelDummy.updateMatrix();
        this.pixelGrid.setMatrixAt(idx, this.pixelDummy.matrix);
      }
    }
    this.pixelGrid.instanceMatrix.needsUpdate = true;
  }

  private resetGame(): void {
    this.aliens = [];
    this.bullets = [];

    // Create alien grid (5 rows, 7 columns) - fills more of the screen
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 7; col++) {
        this.aliens.push({
          x: 2 + col * 2,
          y: GRID_HEIGHT - 4 - row * 3,
          alive: true,
        });
      }
    }

    this.player.x = Math.floor(GRID_WIDTH / 2);
    this.alienDirection = 'right';
  }

  getObject(): THREE.Group {
    return this.group;
  }

  setColor(color: number): void {
    this.primaryColor = color;

    // Update the base material color for InstancedMesh
    if (this.pixelGrid.material instanceof THREE.MeshBasicMaterial) {
      this.pixelGrid.material.color.setHex(color);
    }
  }

  update(deltaTime: number, activitySpeed: number): void {
    this.moveTimer += deltaTime;
    this.shootTimer += deltaTime;

    const adjustedMoveInterval = this.moveInterval / activitySpeed;
    const adjustedShootInterval = this.shootInterval / activitySpeed;

    // Move aliens
    if (this.moveTimer >= adjustedMoveInterval) {
      this.moveTimer = 0;
      this.moveAliens();
    }

    // Player shoots
    if (this.shootTimer >= adjustedShootInterval) {
      this.shootTimer = 0;
      this.playerShoot();
    }

    // Move bullets
    this.moveBullets(deltaTime, activitySpeed);

    // Move player (follows aliens somewhat)
    this.movePlayer();

    this.updatePixelGrid();
  }

  private moveAliens(): void {
    // Check if we need to change direction
    let needsReverse = false;
    let lowestY = GRID_HEIGHT;

    for (const alien of this.aliens) {
      if (!alien.alive) continue;

      if (this.alienDirection === 'right' && alien.x >= GRID_WIDTH - 2) {
        needsReverse = true;
      } else if (this.alienDirection === 'left' && alien.x <= 1) {
        needsReverse = true;
      }

      if (alien.y < lowestY) {
        lowestY = alien.y;
      }
    }

    if (needsReverse) {
      this.alienDirection = this.alienDirection === 'right' ? 'left' : 'right';
      // Move down
      for (const alien of this.aliens) {
        if (alien.alive) {
          alien.y -= 1;
        }
      }
    } else {
      // Move horizontally
      const dx = this.alienDirection === 'right' ? 1 : -1;
      for (const alien of this.aliens) {
        if (alien.alive) {
          alien.x += dx;
        }
      }
    }

    // Check if aliens reached bottom or all dead
    const aliveAliens = this.aliens.filter(a => a.alive);
    if (lowestY <= 2 || aliveAliens.length === 0) {
      this.resetGame();
    }

    // Aliens occasionally shoot
    if (Math.random() < 0.2 && aliveAliens.length > 0) {
      const shooter = aliveAliens[Math.floor(Math.random() * aliveAliens.length)];
      this.bullets.push({
        x: shooter.x,
        y: shooter.y - 1,
        isPlayerBullet: false,
      });
    }
  }

  private movePlayer(): void {
    // Simple AI: move toward center of alien swarm
    const aliveAliens = this.aliens.filter(a => a.alive);
    if (aliveAliens.length === 0) return;

    const avgX = aliveAliens.reduce((sum, a) => sum + a.x, 0) / aliveAliens.length;

    if (Math.random() < 0.3) {
      if (this.player.x < avgX && this.player.x < GRID_WIDTH - 2) {
        this.player.x++;
      } else if (this.player.x > avgX && this.player.x > 1) {
        this.player.x--;
      }
    }
  }

  private playerShoot(): void {
    // Don't shoot too many bullets
    const playerBullets = this.bullets.filter(b => b.isPlayerBullet);
    if (playerBullets.length < 2) {
      this.bullets.push({
        x: this.player.x,
        y: 5, // Start above the player ship (ship top is at y=4)
        isPlayerBullet: true,
      });
    }
  }

  private moveBullets(_deltaTime: number, activitySpeed: number): void {
    // Move bullets every frame
    for (const bullet of this.bullets) {
      if (bullet.isPlayerBullet) {
        bullet.y += 0.3 * activitySpeed;
      } else {
        bullet.y -= 0.2 * activitySpeed;
      }
    }

    // Check collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];

      // Remove off-screen bullets
      if (bullet.y < 0 || bullet.y >= GRID_HEIGHT) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (bullet.isPlayerBullet) {
        // Check alien collision
        for (const alien of this.aliens) {
          if (alien.alive &&
              Math.abs(alien.x - bullet.x) < 1.5 &&
              Math.abs(alien.y - bullet.y) < 1.5) {
            alien.alive = false;
            this.bullets.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  private updatePixelGrid(): void {
    const offsetX = -(GRID_WIDTH * (PIXEL_SIZE + PIXEL_GAP)) / 2;
    const offsetY = -(GRID_HEIGHT * (PIXEL_SIZE + PIXEL_GAP)) / 2;

    // Build a map of what's at each pixel
    const pixelMap: Map<string, 'alien' | 'player' | 'bullet'> = new Map();

    // Aliens (3x3 pattern)
    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      // Simple alien shape
      pixelMap.set(`${alien.x},${Math.floor(alien.y)}`, 'alien');
      pixelMap.set(`${alien.x - 1},${Math.floor(alien.y)}`, 'alien');
      pixelMap.set(`${alien.x + 1},${Math.floor(alien.y)}`, 'alien');
      pixelMap.set(`${alien.x},${Math.floor(alien.y) + 1}`, 'alien');
    }

    // Player (bigger ship shape - 5 pixels wide)
    const py = 2;
    // Base row (5 wide)
    pixelMap.set(`${this.player.x},${py}`, 'player');
    pixelMap.set(`${this.player.x - 1},${py}`, 'player');
    pixelMap.set(`${this.player.x + 1},${py}`, 'player');
    pixelMap.set(`${this.player.x - 2},${py}`, 'player');
    pixelMap.set(`${this.player.x + 2},${py}`, 'player');
    // Middle row (3 wide)
    pixelMap.set(`${this.player.x},${py + 1}`, 'player');
    pixelMap.set(`${this.player.x - 1},${py + 1}`, 'player');
    pixelMap.set(`${this.player.x + 1},${py + 1}`, 'player');
    // Top (cannon)
    pixelMap.set(`${this.player.x},${py + 2}`, 'player');

    // Bullets
    for (const bullet of this.bullets) {
      const bx = Math.floor(bullet.x);
      const by = Math.floor(bullet.y);
      if (bx >= 0 && bx < GRID_WIDTH && by >= 0 && by < GRID_HEIGHT) {
        pixelMap.set(`${bx},${by}`, 'bullet');
      }
    }

    // Update pixel grid
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const idx = y * GRID_WIDTH + x;
        const key = `${x},${y}`;
        const pixelType = pixelMap.get(key);

        this.pixelDummy.position.set(
          offsetX + x * (PIXEL_SIZE + PIXEL_GAP),
          offsetY + y * (PIXEL_SIZE + PIXEL_GAP),
          0
        );

        if (pixelType) {
          this.pixelDummy.scale.set(1, 1, 1);
          this.pixelGrid.setColorAt(idx, new THREE.Color(this.primaryColor));
        } else {
          this.pixelDummy.scale.set(0, 0, 0);
        }

        this.pixelDummy.updateMatrix();
        this.pixelGrid.setMatrixAt(idx, this.pixelDummy.matrix);
      }
    }

    this.pixelGrid.instanceMatrix.needsUpdate = true;
    if (this.pixelGrid.instanceColor) {
      this.pixelGrid.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    this.pixelGrid.geometry.dispose();
    if (this.pixelGrid.material instanceof THREE.Material) {
      this.pixelGrid.material.dispose();
    }
  }
}
