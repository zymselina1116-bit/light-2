// Canvas setup
const canvas = document.getElementById('fireCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game state
const state = {
    spindleMode: 0, // 0: normal wood, 1: pointed wood, 2: iron
    rotation: 0,
    rotationSpeed: 0,
    ignitionProgress: 0,
    fireLit: false,
    cottonPlaced: false,
    cottonInFire: false,
    showForest: false,
    flameSize: 1,
    mouseX: 0,
    mouseY: 0,
    prevMouseX: 0,
    prevMouseY: 0,
    mouseSpeed: 0,
    draggingItem: null,
    dragOffset: { x: 0, y: 0 },
    isRotating: false,
    rotatingSpindle: false
};

// Spindle configurations
const spindleConfigs = [
    {
        name: 'Normal Wood',
        ignitionTime: 10,
        ignitionTimeCotton: 5,
        sparkSize: 3,
        sparkBrightness: 1,
        color: '#8B4513'
    },
    {
        name: 'Pointed Wood',
        ignitionTime: 7,
        ignitionTimeCotton: 3,
        sparkSize: 3.5,
        sparkBrightness: 1.2,
        color: '#A0522D'
    },
    {
        name: 'Iron Spindle',
        ignitionTime: 20,
        ignitionTimeCotton: 15,
        sparkSize: 1.5,
        sparkBrightness: 0.5,
        color: '#708090'
    }
];

// Draggable items
const items = [
    {
        id: 'cotton',
        name: 'Cotton',
        x: canvas.width - 150,
        y: 150,
        width: 80,
        height: 60,
        available: true,
        placed: false,
        color: '#F5F5DC'
    },
    {
        id: 'fan',
        name: 'Fan',
        x: canvas.width - 150,
        y: 250,
        width: 80,
        height: 80,
        available: false,
        color: '#8B7355'
    },
    {
        id: 'bucket',
        name: 'Water Bucket',
        x: canvas.width - 150,
        y: 370,
        width: 70,
        height: 70,
        available: false,
        color: '#4682B4'
    }
];

// Particles system
const sparks = [];
const SPARK_THRESHOLD = 8; // Minimum rotation speed for sparks

// Center positions
let centerX, centerY;
let baseY;
let spindleContactY;

function updatePositions() {
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    baseY = centerY + 100;
    spindleContactY = centerY + 80;

    // Update draggable item positions on resize
    items[0].x = canvas.width - 150;
    items[1].x = canvas.width - 150;
    items[2].x = canvas.width - 150;
}
updatePositions();
window.addEventListener('resize', updatePositions);

// Mouse tracking
let lastMouseMoveTime = Date.now();

canvas.addEventListener('mousemove', (e) => {
    state.prevMouseX = state.mouseX;
    state.prevMouseY = state.mouseY;
    state.mouseX = e.clientX;
    state.mouseY = e.clientY;

    // Calculate mouse speed
    const dx = state.mouseX - state.prevMouseX;
    const dy = state.mouseY - state.prevMouseY;
    const currentTime = Date.now();
    const deltaTime = currentTime - lastMouseMoveTime;

    if (deltaTime > 0) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        state.mouseSpeed = distance / (deltaTime / 16.67); // Normalized to ~60fps
    }

    lastMouseMoveTime = currentTime;

    // Handle dragging items
    if (state.draggingItem && state.draggingItem !== 'spindle') {
        const item = items.find(i => i.id === state.draggingItem);
        if (item && !item.placed) {
            item.x = state.mouseX - state.dragOffset.x;
            item.y = state.mouseY - state.dragOffset.y;
        }

        // Fan increases flame based on drag speed when near fire
        if (state.draggingItem === 'fan' && state.fireLit) {
            const distToFire = Math.sqrt((state.mouseX - centerX) ** 2 + (state.mouseY - centerY) ** 2);
            if (distToFire < 150) {
                const fanSpeed = Math.sqrt(dx * dx + dy * dy);
                state.flameSize += fanSpeed * 0.008;
                state.flameSize = Math.min(state.flameSize, 4);
            }
        }
    }

    // Handle spindle rotation via drag
    if (state.rotatingSpindle && !state.fireLit) {
        state.mouseSpeed = Math.sqrt(dx * dx + dy * dy) / (deltaTime / 16.67);
    }
});

// Decay mouse speed when not moving
setInterval(() => {
    const currentTime = Date.now();
    if (currentTime - lastMouseMoveTime > 100 || !state.rotatingSpindle) {
        state.mouseSpeed *= 0.9;
        if (state.mouseSpeed < 0.01) state.mouseSpeed = 0;
    }
}, 16);

// Drag and drop handlers
canvas.addEventListener('mousedown', (e) => {
    // Check if clicking on spindle for rotation or mode change
    if (!state.fireLit) {
        const dx = e.clientX - centerX;
        const dy = e.clientY - (centerY - 80);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 60) {
            if (e.shiftKey) {
                // Shift+click to change mode
                state.spindleMode = (state.spindleMode + 1) % 3;
                state.ignitionProgress = 0;
                return;
            } else {
                // Regular click to start rotating
                state.rotatingSpindle = true;
                state.draggingItem = 'spindle';
                canvas.classList.add('dragging');
                return;
            }
        }
    }

    // Check for draggable items
    for (const item of items) {
        if (!item.available || item.placed) continue;

        const dx = e.clientX - item.x;
        const dy = e.clientY - item.y;

        if (dx >= 0 && dx <= item.width && dy >= 0 && dy <= item.height) {
            state.draggingItem = item.id;
            state.dragOffset = { x: dx, y: dy };
            canvas.classList.add('dragging');
            break;
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (state.draggingItem === 'spindle') {
        state.rotatingSpindle = false;
        state.draggingItem = null;
        canvas.classList.remove('dragging');
        return;
    }

    if (state.draggingItem) {
        const item = items.find(i => i.id === state.draggingItem);

        if (item) {
            // Check drop zones
            if (item.id === 'cotton' && !state.fireLit) {
                // Check if dropped near contact point (before fire)
                const dx = e.clientX - centerX;
                const dy = e.clientY - spindleContactY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 80) {
                    item.placed = true;
                    item.x = centerX - 40;
                    item.y = spindleContactY - 25;
                    state.cottonPlaced = true;
                } else {
                    // Return to original position
                    item.x = canvas.width - 150;
                    item.y = 150;
                }
            } else if (item.id === 'cotton' && state.fireLit) {
                // Check if dropped on flame (after fire is lit)
                const dx = e.clientX - centerX;
                const dy = e.clientY - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 100) {
                    state.cottonInFire = true;
                    state.showForest = true;
                    state.flameSize += 1.5;
                    item.available = false;
                } else {
                    // Return to original position
                    item.x = canvas.width - 150;
                    item.y = 150;
                }
            } else if (item.id === 'bucket' && state.fireLit) {
                // Check if dropped on flame
                const dx = e.clientX - centerX;
                const dy = e.clientY - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 100) {
                    extinguishFire();
                }
                // Return bucket to original position
                item.x = canvas.width - 150;
                item.y = 370;
            } else if (!item.placed) {
                // Return to original position
                if (item.id === 'fan') {
                    item.x = canvas.width - 150;
                    item.y = 250;
                }
            }
        }

        state.draggingItem = null;
        canvas.classList.remove('dragging');
    }
});

// Extinguish fire
function extinguishFire() {
    state.fireLit = false;
    state.flameSize = 1;
    state.ignitionProgress = 0;
    state.rotation = 0;
    state.rotationSpeed = 0;
    state.cottonInFire = false;
    state.showForest = false;
    sparks.length = 0;

    // Reset cotton
    const cottonItem = items.find(i => i.id === 'cotton');
    if (state.cottonPlaced) {
        cottonItem.placed = false;
        cottonItem.x = canvas.width - 150;
        cottonItem.y = 150;
        state.cottonPlaced = false;
    }
    cottonItem.available = true;

    // Disable fan and bucket
    items.find(i => i.id === 'fan').available = false;
    items.find(i => i.id === 'bucket').available = false;
}

// Create spark particle
function createSpark(x, y, config) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 1;

    sparks.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        size: config.sparkSize * (0.5 + Math.random() * 0.5),
        brightness: config.sparkBrightness
    });
}

// Update function
function update(deltaTime) {
    // Update rotation based on mouse speed
    if (!state.fireLit) {
        state.rotationSpeed = state.mouseSpeed * 0.3;
        state.rotation += state.rotationSpeed * deltaTime / 16.67;

        const config = spindleConfigs[state.spindleMode];
        const ignitionTime = state.cottonPlaced ? config.ignitionTimeCotton : config.ignitionTime;

        // Update ignition progress
        if (state.rotationSpeed > SPARK_THRESHOLD) {
            state.ignitionProgress += deltaTime / (ignitionTime * 1000);

            // Create sparks
            if (Math.random() < 0.3) {
                createSpark(
                    centerX + (Math.random() - 0.5) * 20,
                    spindleContactY + (Math.random() - 0.5) * 10,
                    config
                );
            }

            // Check if fire is lit
            if (state.ignitionProgress >= 1) {
                state.fireLit = true;
                state.ignitionProgress = 1;
                // Enable fan, bucket, and cotton (for adding to fire)
                items.find(i => i.id === 'fan').available = true;
                items.find(i => i.id === 'bucket').available = true;
                const cottonItem = items.find(i => i.id === 'cotton');
                if (!state.cottonInFire) {
                    cottonItem.available = true;
                    cottonItem.placed = false;
                }
            }
        } else if (state.rotationSpeed < 1) {
            // Reset progress if rotation stops
            state.ignitionProgress *= 0.95;
            if (state.ignitionProgress < 0.01) state.ignitionProgress = 0;

            // Remove sparks when stopped
            if (state.rotationSpeed < 0.1) {
                sparks.length = 0;
            }
        }
    }

    // Update sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
        const spark = sparks[i];
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.1; // Gravity
        spark.life -= deltaTime / 1000;

        if (spark.life <= 0) {
            sparks.splice(i, 1);
        }
    }

    // Decay flame size
    if (state.fireLit && state.draggingItem !== 'fan') {
        state.flameSize *= 0.99;
        state.flameSize = Math.max(state.flameSize, 1);
    }
}

// Draw functions
function drawBase() {
    ctx.fillStyle = '#654321';
    ctx.fillRect(centerX - 180, baseY - 20, 360, 40);

    // Base texture
    ctx.fillStyle = '#4a3319';
    for (let i = 0; i < 8; i++) {
        const x = centerX - 160 + i * 40;
        ctx.fillRect(x, baseY - 16, 3, 32);
    }

    // Add some wood grain detail
    ctx.fillStyle = '#543210';
    for (let i = 0; i < 6; i++) {
        const x = centerX - 140 + i * 50;
        ctx.fillRect(x, baseY - 10, 20, 4);
        ctx.fillRect(x + 10, baseY + 5, 15, 3);
    }
}

function drawSpindle() {
    if (state.fireLit) return;

    const config = spindleConfigs[state.spindleMode];

    ctx.save();
    ctx.translate(centerX, centerY - 80);
    ctx.rotate(state.rotation);

    // Draw spindle based on mode
    ctx.fillStyle = config.color;

    if (state.spindleMode === 0) {
        // Normal wood - flat ends (larger)
        ctx.fillRect(-15, -100, 30, 200);
        // Top cap
        ctx.fillRect(-18, -104, 36, 6);
        // Bottom cap
        ctx.fillRect(-18, 98, 36, 6);

        // Wood grain
        ctx.fillStyle = '#6B3410';
        for (let i = -80; i < 80; i += 20) {
            ctx.fillRect(-13, i, 2, 12);
            ctx.fillRect(11, i + 5, 2, 12);
        }
    } else if (state.spindleMode === 1) {
        // Pointed wood (larger)
        ctx.beginPath();
        ctx.moveTo(0, -100);
        ctx.lineTo(-15, -85);
        ctx.lineTo(-15, 85);
        ctx.lineTo(0, 100);
        ctx.lineTo(15, 85);
        ctx.lineTo(15, -85);
        ctx.closePath();
        ctx.fill();

        // Wood grain
        ctx.fillStyle = '#8B5A2B';
        for (let i = -70; i < 70; i += 20) {
            ctx.fillRect(-12, i, 2, 12);
            ctx.fillRect(10, i + 5, 2, 12);
        }
    } else if (state.spindleMode === 2) {
        // Iron - metallic look (larger)
        ctx.fillRect(-13, -100, 26, 200);

        // Metallic shine
        const gradient = ctx.createLinearGradient(-13, 0, 13, 0);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(-13, -100, 26, 200);
    }

    ctx.restore();

    // Draw mode label
    ctx.fillStyle = '#fff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(config.name, centerX, centerY - 200);
    ctx.font = '12px Arial';
    ctx.fillText('(Shift+Click to change mode)', centerX, centerY - 180);
}

function drawCotton() {
    const cottonItem = items.find(i => i.id === 'cotton');
    if (cottonItem.placed && !state.fireLit) {
        // Draw cotton at contact point (larger)
        ctx.fillStyle = cottonItem.color;
        ctx.beginPath();
        ctx.ellipse(centerX, spindleContactY, 50, 35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cotton texture
        ctx.fillStyle = '#E8E8D8';
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * 25;
            const y = spindleContactY + Math.sin(angle) * 18;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawSparks() {
    for (const spark of sparks) {
        const alpha = spark.life;
        const size = spark.size * spark.life;

        ctx.fillStyle = `rgba(255, ${200 * spark.brightness}, ${50 * spark.brightness}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.fillStyle = `rgba(255, ${150 * spark.brightness}, 0, ${alpha * 0.3})`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, size * 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawHeatGlow() {
    if (state.ignitionProgress > 0 && !state.fireLit) {
        const glowIntensity = state.ignitionProgress;
        const gradient = ctx.createRadialGradient(
            centerX, spindleContactY, 0,
            centerX, spindleContactY, 60 * glowIntensity
        );
        gradient.addColorStop(0, `rgba(255, 100, 0, ${0.6 * glowIntensity})`);
        gradient.addColorStop(0.5, `rgba(255, 50, 0, ${0.3 * glowIntensity})`);
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, spindleContactY, 60 * glowIntensity, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFlame() {
    if (!state.fireLit) return;

    const time = Date.now() / 100;
    const baseSize = 40 * state.flameSize;

    // Main flame body
    for (let i = 0; i < 3; i++) {
        const offset = Math.sin(time + i) * 5;
        const flameHeight = baseSize * (1.5 - i * 0.2);
        const flameWidth = baseSize * (1 - i * 0.2);

        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY - flameHeight / 2, flameHeight
        );

        if (i === 0) {
            gradient.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
            gradient.addColorStop(0.3, 'rgba(255, 200, 0, 0.8)');
            gradient.addColorStop(0.6, 'rgba(255, 100, 0, 0.6)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        } else if (i === 1) {
            gradient.addColorStop(0, 'rgba(255, 150, 0, 0.7)');
            gradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.5)');
            gradient.addColorStop(1, 'rgba(200, 0, 0, 0)');
        } else {
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.4)');
            gradient.addColorStop(1, 'rgba(100, 0, 0, 0)');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(centerX + offset, centerY, flameWidth / 2, flameHeight, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Flame flickers
    for (let i = 0; i < 5; i++) {
        const angle = (time + i * 0.5) * 2;
        const radius = baseSize * 0.3;
        const x = centerX + Math.cos(angle) * radius * 0.5;
        const y = centerY - baseSize * 0.8 + Math.sin(time * 2 + i) * 10;

        ctx.fillStyle = `rgba(255, ${150 + Math.sin(time + i) * 50}, 0, 0.6)`;
        ctx.beginPath();
        ctx.arc(x, y, 5 * state.flameSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawDraggableItems() {
    for (const item of items) {
        if (!item.available || item.placed) continue;

        ctx.save();

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(item.x + 5, item.y + 5, item.width, item.height);

        // Item background
        ctx.fillStyle = item.color;
        ctx.fillRect(item.x, item.y, item.width, item.height);

        // Item border
        ctx.strokeStyle = state.draggingItem === item.id ? '#fff' : '#333';
        ctx.lineWidth = 3;
        ctx.strokeRect(item.x, item.y, item.width, item.height);

        // Item-specific drawing
        if (item.id === 'cotton') {
            // Cotton tufts
            ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 6; i++) {
                const x = item.x + 20 + (i % 3) * 20;
                const y = item.y + 20 + Math.floor(i / 3) * 20;
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (item.id === 'fan') {
            // Fan blades
            ctx.fillStyle = '#D2B48C';
            for (let i = 0; i < 6; i++) {
                ctx.save();
                ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
                ctx.rotate((i / 6) * Math.PI * 2);
                ctx.fillRect(-5, 0, 10, 30);
                ctx.restore();
            }
            // Fan handle
            ctx.fillStyle = '#654321';
            ctx.fillRect(item.x + item.width / 2 - 5, item.y + item.height / 2, 10, 25);
        } else if (item.id === 'bucket') {
            // Bucket body
            ctx.fillStyle = '#5A8FB4';
            ctx.fillRect(item.x + 10, item.y + 15, item.width - 20, item.height - 20);
            // Water surface
            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(item.x + 10, item.y + 15, item.width - 20, 15);
            // Bucket handle
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(item.x + item.width / 2, item.y + 20, 15, Math.PI, 0);
            ctx.stroke();
        }

        // Item label
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.name, item.x + item.width / 2, item.y + item.height + 15);

        ctx.restore();
    }
}

function drawIgnitionProgress() {
    if (state.ignitionProgress > 0 && !state.fireLit) {
        // Progress bar
        const barWidth = 200;
        const barHeight = 20;
        const barX = centerX - barWidth / 2;
        const barY = centerY + 120;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Progress
        const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
        gradient.addColorStop(0, '#ff6600');
        gradient.addColorStop(0.5, '#ff3300');
        gradient.addColorStop(1, '#ff0000');
        ctx.fillStyle = gradient;
        ctx.fillRect(barX, barY, barWidth * state.ignitionProgress, barHeight);

        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Text
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Ignition Progress', centerX, barY - 5);
    }
}

// Draw rainforest background
function drawForest() {
    if (!state.showForest) return;

    const time = Date.now() / 1000;

    // Tropical sky with mist - darker, more humid atmosphere
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, '#5C8A8A');
    skyGradient.addColorStop(0.4, '#6B9B9B');
    skyGradient.addColorStop(0.7, '#7AB8A8');
    skyGradient.addColorStop(1, '#88C9B8');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mist/fog layers
    for (let i = 0; i < 3; i++) {
        const mistGradient = ctx.createRadialGradient(
            canvas.width * (0.3 + i * 0.2),
            canvas.height * 0.3,
            0,
            canvas.width * (0.3 + i * 0.2),
            canvas.height * 0.3,
            canvas.width * 0.4
        );
        mistGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        mistGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = mistGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Dense jungle ground with rich soil
    ctx.fillStyle = '#1a3a2a';
    ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.35);

    // Undergrowth layers - darker greens
    ctx.fillStyle = '#234d34';
    ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.1);

    // Dense foliage in foreground (ferns and bushes)
    for (let i = 0; i < 40; i++) {
        const x = (i / 40) * canvas.width;
        const y = canvas.height * 0.72 + Math.random() * 50;
        const size = 20 + Math.random() * 30;

        // Large tropical leaves
        ctx.fillStyle = i % 2 === 0 ? '#1e4d2b' : '#2a5c3a';
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 1.5, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }

    // Background layers - distant jungle
    for (let layer = 0; layer < 3; layer++) {
        const layerY = canvas.height * (0.35 + layer * 0.1);
        const opacity = 0.3 + layer * 0.2;

        for (let i = 0; i < 8; i++) {
            const x = (i / 8) * canvas.width + (layer * 50);
            ctx.fillStyle = `rgba(46, 125, 50, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, layerY, 40 + layer * 20, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Tall tropical trees with palm-like appearance
    const rainforestTrees = [
        { x: canvas.width * 0.12, y: canvas.height * 0.45, size: 1.3, type: 'palm' },
        { x: canvas.width * 0.22, y: canvas.height * 0.5, size: 1.0, type: 'broad' },
        { x: canvas.width * 0.35, y: canvas.height * 0.48, size: 1.2, type: 'palm' },
        { x: canvas.width * 0.65, y: canvas.height * 0.47, size: 1.1, type: 'broad' },
        { x: canvas.width * 0.78, y: canvas.height * 0.52, size: 0.9, type: 'palm' },
        { x: canvas.width * 0.88, y: canvas.height * 0.5, size: 1.15, type: 'broad' },
        { x: canvas.width * 0.05, y: canvas.height * 0.55, size: 0.85, type: 'palm' },
        { x: canvas.width * 0.95, y: canvas.height * 0.54, size: 0.95, type: 'broad' }
    ];

    for (const tree of rainforestTrees) {
        // Tall, slender trunk
        ctx.fillStyle = '#4a3428';
        const trunkWidth = tree.type === 'palm' ? 12 : 18;
        ctx.fillRect(
            tree.x - (trunkWidth / 2) * tree.size,
            tree.y,
            trunkWidth * tree.size,
            100 * tree.size
        );

        // Trunk texture
        ctx.fillStyle = '#3a2418';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(
                tree.x - (trunkWidth / 2) * tree.size,
                tree.y + i * 20 * tree.size,
                trunkWidth * tree.size,
                3
            );
        }

        if (tree.type === 'palm') {
            // Palm fronds
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                ctx.save();
                ctx.translate(tree.x, tree.y - 10 * tree.size);
                ctx.rotate(angle);

                // Frond gradient
                const frondGradient = ctx.createLinearGradient(0, 0, 0, 60 * tree.size);
                frondGradient.addColorStop(0, '#2d5016');
                frondGradient.addColorStop(1, '#1a3010');
                ctx.fillStyle = frondGradient;

                // Long leaf shape
                ctx.beginPath();
                ctx.ellipse(0, 30 * tree.size, 12 * tree.size, 50 * tree.size, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }
        } else {
            // Broad-leaf canopy (multiple layers)
            const canopyLayers = [
                { offset: 0, size: 70, color: '#1e4d2b' },
                { offset: -20, size: 60, color: '#2a5c3a' },
                { offset: 20, size: 55, color: '#1a3a1a' },
                { offset: -30, size: 50, color: '#234d2b' }
            ];

            for (const layer of canopyLayers) {
                ctx.fillStyle = layer.color;
                ctx.beginPath();
                ctx.arc(
                    tree.x + layer.offset * tree.size * 0.5,
                    tree.y - 10 * tree.size,
                    layer.size * tree.size,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        }
    }

    // Hanging vines
    for (let i = 0; i < 15; i++) {
        const vineX = (i / 15) * canvas.width + Math.sin(time + i) * 10;
        const vineStartY = canvas.height * (0.2 + Math.random() * 0.2);
        const vineLength = 100 + Math.random() * 150;

        ctx.strokeStyle = 'rgba(40, 60, 30, 0.6)';
        ctx.lineWidth = 2 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(vineX, vineStartY);

        // Curved vine
        for (let j = 0; j < 10; j++) {
            const y = vineStartY + (j / 10) * vineLength;
            const xOffset = Math.sin(time * 0.5 + i + j * 0.5) * 15;
            ctx.lineTo(vineX + xOffset, y);
        }
        ctx.stroke();

        // Small leaves on vines
        for (let j = 0; j < 5; j++) {
            const leafY = vineStartY + (j / 5) * vineLength;
            const leafX = vineX + Math.sin(time * 0.5 + i + j * 0.5) * 15;
            ctx.fillStyle = '#2a5c3a';
            ctx.beginPath();
            ctx.ellipse(leafX + 5, leafY, 8, 12, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Large tropical plants in foreground
    for (let i = 0; i < 10; i++) {
        const plantX = (i / 10) * canvas.width;
        const plantY = canvas.height * 0.75;

        // Large fan leaves
        for (let j = 0; j < 5; j++) {
            const angle = (j / 5) * Math.PI - Math.PI / 2;
            ctx.save();
            ctx.translate(plantX, plantY);
            ctx.rotate(angle);

            const leafGradient = ctx.createLinearGradient(0, 0, 0, 60);
            leafGradient.addColorStop(0, '#1e4d2b');
            leafGradient.addColorStop(1, '#0d2614');
            ctx.fillStyle = leafGradient;

            ctx.beginPath();
            ctx.ellipse(0, 30, 20, 50, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    // Atmospheric rain effect
    ctx.strokeStyle = 'rgba(200, 220, 230, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * canvas.width;
        const y = (Math.random() * canvas.height + time * 200 * (i % 3 + 1)) % canvas.height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y + 15);
        ctx.stroke();
    }
}

// Animation loop
let lastTime = Date.now();

function animate() {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    update(deltaTime);

    // Draw background
    if (state.showForest) {
        drawForest();
    } else {
        // Clear canvas with dark background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw everything
    drawBase();
    drawCotton();
    drawHeatGlow();
    drawSparks();
    drawSpindle();
    drawFlame();
    drawIgnitionProgress();
    drawDraggableItems();

    requestAnimationFrame(animate);
}

animate();
