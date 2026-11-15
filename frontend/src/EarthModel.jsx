import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function disposeModel(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (!object.material) return;

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of objectMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

export default function EarthModel({ modelUrl, isAnimated, onLoad }) {
  const containerRef = useRef(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power"
      });
    } catch (renderError) {
      console.error("Could not initialize the Earth preview.", renderError);
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xc5e6ff, 0x07111f, 1.15));
    const sunlight = new THREE.DirectionalLight(0xfff0d7, 2.2);
    sunlight.position.set(-3, 4, 5);
    scene.add(sunlight);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    let earth = null;
    let animationFrame = 0;
    let disposed = false;
    let lastFrameTime = 0;

    function render() {
      renderer.render(scene, camera);
    }

    function resize() {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;

      const aspect = width / height;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    }

    function animate(timestamp) {
      if (disposed) return;
      const delta = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0;
      lastFrameTime = timestamp;
      if (earth) earth.rotation.y += delta * 0.025;
      render();
      animationFrame = window.requestAnimationFrame(animate);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    window.addEventListener("resize", resize);
    resize();

    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        if (disposed) {
          disposeModel(gltf.scene);
          return;
        }

        const bounds = new THREE.Box3().setFromObject(gltf.scene);
        const center = bounds.getCenter(new THREE.Vector3());
        const dimensions = bounds.getSize(new THREE.Vector3());
        const modelRadius =
          Math.max(dimensions.x, dimensions.y, dimensions.z) / 2;
        if (!Number.isFinite(modelRadius) || modelRadius === 0) {
          console.error("The Earth model has no measurable geometry.");
          disposeModel(gltf.scene);
          return;
        }

        const model = new THREE.Group();
        model.add(gltf.scene);
        gltf.scene.position.sub(center);
        gltf.scene.scale.setScalar(2 / modelRadius);
        model.position.y = -1.52;
        scene.add(model);
        earth = model;
        onLoadRef.current();

        if (isAnimated && !animationFrame) {
          animationFrame = window.requestAnimationFrame(animate);
        } else {
          render();
        }
      },
      undefined,
      (loadError) => {
        if (!disposed) {
          console.error("Could not load the Earth model.", loadError);
        }
      }
    );

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
      if (earth) {
        scene.remove(earth);
        disposeModel(earth);
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [isAnimated, modelUrl]);

  return <div ref={containerRef} className="earth-model" aria-hidden="true" />;
}
