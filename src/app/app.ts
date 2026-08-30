import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import * as THREE from 'three';

@Component({
  imports: [],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('scene', { static: true }) private sceneRef!: ElementRef<HTMLDivElement>;

  protected readonly menuOpen = signal(false);

  private renderer?: THREE.WebGLRenderer;
  private camera?: THREE.PerspectiveCamera;
  private scene?: THREE.Scene;
  private sculpture?: THREE.Group;
  private particles?: THREE.Points;
  private animationFrame = 0;
  private observer?: IntersectionObserver;
  private startTime = Date.now();
  private pointer = new THREE.Vector2();
  private reducedMotion = false;

  ngAfterViewInit(): void {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.createScene();
    this.createRevealObserver();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.observer?.disconnect();
    window.removeEventListener('resize', this.resizeScene);
    window.removeEventListener('pointermove', this.trackPointer);
    this.renderer?.dispose();
    this.scene?.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.update((value) => !value);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  private createScene(): void {
    const host = this.sceneRef.nativeElement;
    const width = host.clientWidth;
    const height = host.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x08090a, 0.075);
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(0, 0.1, 8.5);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);

    this.sculpture = new THREE.Group();
    this.sculpture.position.set(1.85, 0.15, 0);
    this.scene.add(this.sculpture);

    const solidMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8d9298,
      metalness: 0.86,
      roughness: 0.18,
      clearcoat: 0.75,
      clearcoatRoughness: 0.18,
    });
    const darkMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x17191c,
      metalness: 0.95,
      roughness: 0.28,
      clearcoat: 0.5,
    });
    const wireMaterial = new THREE.LineBasicMaterial({ color: 0xd7d9dc, transparent: true, opacity: 0.48 });

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 2), solidMaterial);
    core.rotation.set(-0.2, 0.45, 0.15);
    this.sculpture.add(core);

    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.05, 0.15, 180, 18, 2, 3), darkMaterial);
    knot.rotation.set(0.8, 0.15, -0.35);
    knot.position.set(-0.2, 0.1, 1.05);
    this.sculpture.add(knot);

    const orbitalGeometry = new THREE.EdgesGeometry(new THREE.TorusGeometry(2.35, 0.012, 8, 180));
    const orbit = new THREE.LineSegments(orbitalGeometry, wireMaterial);
    orbit.rotation.set(1.08, -0.2, 0.28);
    this.sculpture.add(orbit);

    const satellite = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), solidMaterial.clone());
    satellite.position.set(2.15, 1.15, -0.25);
    satellite.rotation.set(0.4, 0.2, 0.5);
    this.sculpture.add(satellite);

    const smallOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 24, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xf5f5f3, emissive: 0xb7bbc0, emissiveIntensity: 0.8, roughness: 0.1 }),
    );
    smallOrb.position.set(-1.95, -1.35, 0.85);
    this.sculpture.add(smallOrb);

    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(650 * 3);
    for (let index = 0; index < positions.length; index += 3) {
      positions[index] = (Math.random() - 0.5) * 16;
      positions[index + 1] = (Math.random() - 0.5) * 10;
      positions[index + 2] = (Math.random() - 0.5) * 8 - 2;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0xb8bcc1, size: 0.012, transparent: true, opacity: 0.45 }),
    );
    this.scene.add(this.particles);

    const keyLight = new THREE.PointLight(0xffffff, 45, 20, 2);
    keyLight.position.set(3.5, 4.5, 4.5);
    const rimLight = new THREE.PointLight(0x8f9aaa, 38, 18, 2);
    rimLight.position.set(-4, -2, 3);
    const ambient = new THREE.AmbientLight(0x9ea4ad, 0.6);
    this.scene.add(keyLight, rimLight, ambient);

    window.addEventListener('resize', this.resizeScene);
    if (!this.reducedMotion) {
      window.addEventListener('pointermove', this.trackPointer, { passive: true });
      this.animateScene();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private animateScene = (): void => {
    if (!this.renderer || !this.scene || !this.camera || !this.sculpture) {
      return;
    }

    const elapsed = (Date.now() - this.startTime) / 1000;
    this.sculpture.rotation.y += 0.0018;
    this.sculpture.rotation.x += (this.pointer.y * 0.13 - this.sculpture.rotation.x) * 0.025;
    this.sculpture.position.y = 0.15 + Math.sin(elapsed * 0.7) * 0.11;
    this.sculpture.position.x += (1.85 + this.pointer.x * 0.22 - this.sculpture.position.x) * 0.025;
    if (this.particles) {
      this.particles.rotation.y = elapsed * 0.012;
    }
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.animateScene);
  };

  private resizeScene = (): void => {
    if (!this.renderer || !this.camera) {
      return;
    }
    const host = this.sceneRef.nativeElement;
    const width = host.clientWidth;
    const height = host.clientHeight;
    this.camera.aspect = width / height;
    this.camera.position.z = width < 760 ? 10.5 : 8.5;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.reducedMotion && this.scene) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private trackPointer = (event: PointerEvent): void => {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  };

  private createRevealObserver(): void {
    const elements = document.querySelectorAll<HTMLElement>('.reveal');
    if (this.reducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    elements.forEach((element) => this.observer?.observe(element));
  }
}
