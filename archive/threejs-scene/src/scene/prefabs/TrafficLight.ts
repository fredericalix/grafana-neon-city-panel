import * as THREE from 'three';
import { Building, BuildingStatus, BuildingActivity } from '../../types';
import { BasePrefab } from './BasePrefab';
import { createBuildingMaterial, createMetalMaterial } from './materials';

/**
 * Traffic Light Prefab - animated signal light
 */
export class TrafficLightPrefab extends BasePrefab {
  private redLight!: THREE.Mesh;
  private yellowLight!: THREE.Mesh;
  private greenLight!: THREE.Mesh;
  private currentLight: 'red' | 'yellow' | 'green' = 'green';
  private lightTimer = 0;
  private body!: THREE.Mesh;

  constructor(building: Building) {
    super(building);
  }

  protected build(): void {
    // Pole
    const poleMat = createMetalMaterial();
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.6, 8);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 0.3;
    pole.castShadow = true;
    this.group.add(pole);

    // Signal box
    const boxGeo = new THREE.BoxGeometry(0.08, 0.2, 0.06);
    const boxMat = createBuildingMaterial(0x1a1a1a);
    this.body = new THREE.Mesh(boxGeo, boxMat);
    this.body.position.y = 0.55;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Visor (hood over lights)
    const visorGeo = new THREE.BoxGeometry(0.1, 0.04, 0.04);
    const visor = new THREE.Mesh(visorGeo, boxMat);
    visor.position.set(0, 0.62, 0.04);
    this.group.add(visor);

    // Lights
    this.redLight = this.createLight(0xff0000, 0.58);
    this.yellowLight = this.createLight(0xffff00, 0.55);
    this.greenLight = this.createLight(0x00ff00, 0.52);

    this.group.add(this.redLight);
    this.group.add(this.yellowLight);
    this.group.add(this.greenLight);

    // Set initial state
    this.updateLights();
  }

  private createLight(color: number, y: number): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(0.025, 16);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
    });
    const light = new THREE.Mesh(geometry, material);
    light.position.set(0, y, 0.035);
    return light;
  }

  private updateLights(): void {
    // Guard against uninitialized properties
    if (!this.redLight || !this.yellowLight || !this.greenLight) return;

    // Dim all lights
    (this.redLight.material as THREE.MeshBasicMaterial).opacity = 0.2;
    (this.yellowLight.material as THREE.MeshBasicMaterial).opacity = 0.2;
    (this.greenLight.material as THREE.MeshBasicMaterial).opacity = 0.2;

    // Brighten current light
    switch (this.currentLight) {
      case 'red':
        (this.redLight.material as THREE.MeshBasicMaterial).opacity = 1.0;
        break;
      case 'yellow':
        (this.yellowLight.material as THREE.MeshBasicMaterial).opacity = 1.0;
        break;
      case 'green':
        (this.greenLight.material as THREE.MeshBasicMaterial).opacity = 1.0;
        break;
    }
  }

  protected onStatusChange(status: BuildingStatus): void {
    // Guard against uninitialized properties
    if (!this.redLight || !this.yellowLight || !this.greenLight) return;

    if (status === 'offline') {
      // All lights off
      (this.redLight.material as THREE.MeshBasicMaterial).opacity = 0.1;
      (this.yellowLight.material as THREE.MeshBasicMaterial).opacity = 0.1;
      (this.greenLight.material as THREE.MeshBasicMaterial).opacity = 0.1;
    } else if (status === 'warning') {
      // Blinking yellow for warning
      this.currentLight = 'yellow';
    } else if (status === 'critical') {
      // Blinking red for critical
      this.currentLight = 'red';
    } else if (status === 'online') {
      // Steady green for online - service is operational
      this.currentLight = 'green';
      this.updateLights();
    } else {
      // Default/unknown status - cycle through lights
      this.updateLights();
    }
  }

  protected onActivityChange(_activity: BuildingActivity): void {
    // Activity affects cycle speed
  }

  override update(deltaTime: number): void {
    super.update(deltaTime);

    // Guard against uninitialized properties
    if (!this.redLight || !this.yellowLight || !this.greenLight) return;
    if (this.status === 'offline') return;

    const speed = this.getActivitySpeed();
    this.lightTimer += deltaTime * speed;

    if (this.status === 'warning') {
      // Blinking yellow for warning
      const blink = Math.sin(this.lightTimer * 4) > 0;
      (this.yellowLight.material as THREE.MeshBasicMaterial).opacity = blink ? 1.0 : 0.2;
      (this.redLight.material as THREE.MeshBasicMaterial).opacity = 0.2;
      (this.greenLight.material as THREE.MeshBasicMaterial).opacity = 0.2;
    } else if (this.status === 'critical') {
      // Blinking red for critical
      const blink = Math.sin(this.lightTimer * 6) > 0;
      (this.redLight.material as THREE.MeshBasicMaterial).opacity = blink ? 1.0 : 0.2;
      (this.yellowLight.material as THREE.MeshBasicMaterial).opacity = 0.2;
      (this.greenLight.material as THREE.MeshBasicMaterial).opacity = 0.2;
    } else if (this.status === 'online') {
      // Steady green for online - no cycling, service is operational
      this.currentLight = 'green';
      this.updateLights();
    } else {
      // Default/unknown status - normal cycling: green (3s) -> yellow (1s) -> red (3s) -> ...
      const cycleTime = 7; // Total cycle time
      const phase = this.lightTimer % cycleTime;

      if (phase < 3) {
        this.currentLight = 'green';
      } else if (phase < 4) {
        this.currentLight = 'yellow';
      } else {
        this.currentLight = 'red';
      }

      this.updateLights();
    }
  }
}
