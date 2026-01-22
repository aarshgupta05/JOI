let scene, camera, renderer, particles;
const count = 12000;
let currentState = 'sphere';

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    // append renderer directly to body (no #container element)
    document.body.appendChild(renderer.domElement);

    camera.position.z = 25;

    createParticles();
    // setupEventListeners removed — no visible UI
    animate();

    // start automatic morph loop (JOI every 10s)
    startAutoJOILoop();
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    function sphericalDistribution(i) {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        
        return {
            x: 8 * Math.cos(theta) * Math.sin(phi),
            y: 8 * Math.sin(theta) * Math.sin(phi),
            z: 8 * Math.cos(phi)
        };
    }

    for (let i = 0; i < count; i++) {
        const point = sphericalDistribution(i);
        
        positions[i * 3] = point.x + (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 1] = point.y + (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 2] = point.z + (Math.random() - 0.5) * 0.5;

        const color = new THREE.Color();
        const depth = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z) / 8;
        color.setHSL(0.5 + depth * 0.2, 0.7, 0.4 + depth * 0.3);

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.08,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    if (particles) scene.remove(particles);
    particles = new THREE.Points(geometry, material);
    particles.rotation.x = 0;
    particles.rotation.y = 0;
    particles.rotation.z = 0;
    scene.add(particles);
}

function createTextPoints(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 100;
    const padding = 20;

    ctx.font = `bold ${fontSize}px Arial`;
    const textMetrics = ctx.measureText(text);
    const textWidth = Math.ceil(textMetrics.width);
    const textHeight = fontSize;

    canvas.width = textWidth + padding * 2;
    canvas.height = textHeight + padding * 2;

    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const points = [];
    const threshold = 128;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            if (pixels[idx] > threshold) {
                if (Math.random() < 0.3) {
                    points.push({
                        x: (x - canvas.width / 2) / (fontSize / 10),
                        y: -(y - canvas.height / 2) / (fontSize / 10)
                    });
                }
            }
        }
    }

    return points;
}

function morphToText(text) {
    currentState = 'text';
    const textPoints = createTextPoints(text);
    const positions = particles.geometry.attributes.position.array;
    const targetPositions = new Float32Array(count * 3);

    gsap.to(particles.rotation, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.5
    });

    for (let i = 0; i < count; i++) {
        if (i < textPoints.length) {
            targetPositions[i * 3] = textPoints[i].x;
            targetPositions[i * 3 + 1] = textPoints[i].y;
            targetPositions[i * 3 + 2] = 0;
        } else {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 20 + 10;
            targetPositions[i * 3] = Math.cos(angle) * radius;
            targetPositions[i * 3 + 1] = Math.sin(angle) * radius;
            targetPositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
        }
    }

    // animate positions using batched gsap calls to keep UI responsive
    const posAttr = particles.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
        const idx = i * 3;
        gsap.to(posAttr, {
            [idx]: targetPositions[idx],
            [idx + 1]: targetPositions[idx + 1],
            [idx + 2]: targetPositions[idx + 2],
            duration: 2,
            ease: "power2.inOut",
            onUpdate: () => {
                particles.geometry.attributes.position.needsUpdate = true;
            }
        });
    }

    // after some time, morph back to sphere
    setTimeout(() => {
        morphToCircle();
    }, 4000);
}

function morphToCircle() {
    currentState = 'sphere';
    const positions = particles.geometry.attributes.position.array;
    const targetPositions = new Float32Array(count * 3);
    const colors = particles.geometry.attributes.color.array;

    function sphericalDistribution(i) {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        
        return {
            x: 8 * Math.cos(theta) * Math.sin(phi),
            y: 8 * Math.sin(theta) * Math.sin(phi),
            z: 8 * Math.cos(phi)
        };
    }

    for (let i = 0; i < count; i++) {
        const point = sphericalDistribution(i);
        
        targetPositions[i * 3] = point.x + (Math.random() - 0.5) * 0.5;
        targetPositions[i * 3 + 1] = point.y + (Math.random() - 0.5) * 0.5;
        targetPositions[i * 3 + 2] = point.z + (Math.random() - 0.5) * 0.5;

        const depth = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z) / 8;
        const color = new THREE.Color();
        color.setHSL(0.5 + depth * 0.2, 0.7, 0.4 + depth * 0.3);
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    for (let i = 0; i < positions.length; i += 3) {
        gsap.to(particles.geometry.attributes.position.array, {
            [i]: targetPositions[i],
            [i + 1]: targetPositions[i + 1],
            [i + 2]: targetPositions[i + 2],
            duration: 2,
            ease: "power2.inOut",
            onUpdate: () => {
                particles.geometry.attributes.position.needsUpdate = true;
            }
        });
    }

    for (let i = 0; i < colors.length; i += 3) {
        gsap.to(particles.geometry.attributes.color.array, {
            [i]: colors[i],
            [i + 1]: colors[i + 1],
            [i + 2]: colors[i + 2],
            duration: 2,
            ease: "power2.inOut",
            onUpdate: () => {
                particles.geometry.attributes.color.needsUpdate = true;
            }
        });
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (currentState === 'sphere') {
        particles.rotation.y += 0.002;
    }
    
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Auto JOI morph (no typing animation, no UI) ----------

const AUTO_WORD = 'JOI 2.0';
const PERIOD = 10000; // 10 seconds
let autoIntervalHandle = null;

function startAutoJOILoop() {
  // initial small delay, then periodic morphs
  setTimeout(() => {
    if (currentState !== 'text') morphToText(AUTO_WORD);
  }, 1200);

  autoIntervalHandle = setInterval(() => {
    if (currentState !== 'text') morphToText(AUTO_WORD);
  }, PERIOD);
}

// expose init
init();