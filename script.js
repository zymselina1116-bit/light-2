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
    flameSize: 1,
    mouseX: 0,
    mouseY: 0,
    prevMouseX: 0,
    prevMouseY: 0,
    mouseSpeed: 0,
    draggingItem: null,
    dragOffset: { x: 0, y: 0 }
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
    baseY = centerY + 50;
    spindleContactY = centerY + 40;

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

    // Handle dragging
    if (state.draggingItem) {
        const item = items.find(i => i.id === state.draggingItem);
        if (item && !item.placed) {
            item.x = state.mouseX - state.dragOffset.x;
            item.y = state.mouseY - state.dragOffset.y;
        }
    } else if (state.fireLit && state.draggingItem === 'fan') {
        // Fan increases flame based on drag speed
        const fanSpeed = Math.sqrt(dx * dx + dy * dy);
        state.flameSize += fanSpeed * 0.005;
        state.flameSize = Math.min(state.flameSize, 3);
    }
});

// Decay mouse speed when not moving
setInterval(() => {
    const currentTime = Date.now();
    if (currentTime - lastMouseMoveTime > 100) {
        state.mouseSpeed *= 0.9;
        if (state.mouseSpeed < 0.01) state.mouseSpeed = 0;
    }
}, 16);

// Click handler for spindle mode change
canvas.addEventListener('click', (e) => {
    if (state.fireLit) return;

    const dx = e.clientX - centerX;
    const dy = e.clientY - (centerY - 50);
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if clicked on spindle
    if (distance < 30) {
        state.spindleMode = (state.spindleMode + 1) % 3;
        state.ignitionProgress = 0; // Reset progress on mode change
    }
});

// Drag and drop handlers
canvas.addEventListener('mousedown', (e) => {
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
    if (state.draggingItem) {
        const item = items.find(i => i.id === state.draggingItem);

        if (item) {
            // Check drop zones
            if (item.id === 'cotton' && !state.fireLit) {
                // Check if dropped near contact point
                const dx = e.clientX - centerX;
                const dy = e.clientY - spindleContactY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 60) {
                    item.placed = true;
                    item.x = centerX - 25;
                    item.y = spindleContactY - 15;
                    state.cottonPlaced = true;
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

                if (distance < 80) {
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
    sparks.length = 0;

    // Reset cotton
    if (state.cottonPlaced) {
        const cottonItem = items.find(i => i.id === 'cotton');
        cottonItem.placed = false;
        cottonItem.x = canvas.width - 150;
        cottonItem.y = 150;
        state.cottonPlaced = false;
    }

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
                // Enable fan and bucket
                items.find(i => i.id === 'fan').available = true;
                items.find(i => i.id === 'bucket').available = true;
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
    ctx.fillRect(centerX - 100, baseY - 10, 200, 20);

    // Base texture
    ctx.fillStyle = '#4a3319';
    for (let i = 0; i < 5; i++) {
        const x = centerX - 90 + i * 40;
        ctx.fillRect(x, baseY - 8, 2, 16);
    }
}

function drawSpindle() {
    if (state.fireLit) return;

    const config = spindleConfigs[state.spindleMode];

    ctx.save();
    ctx.translate(centerX, centerY - 50);
    ctx.rotate(state.rotation);

    // Draw spindle based on mode
    ctx.fillStyle = config.color;

    if (state.spindleMode === 0) {
        // Normal wood - flat ends
        ctx.fillRect(-8, -60, 16, 120);
        // Top cap
        ctx.fillRect(-10, -62, 20, 4);
        // Bottom cap
        ctx.fillRect(-10, 58, 20, 4);
    } else if (state.spindleMode === 1) {
        // Pointed wood
        ctx.beginPath();
        ctx.moveTo(0, -60);
        ctx.lineTo(-8, -50);
        ctx.lineTo(-8, 50);
        ctx.lineTo(0, 60);
        ctx.lineTo(8, 50);
        ctx.lineTo(8, -50);
        ctx.closePath();
        ctx.fill();
    } else if (state.spindleMode === 2) {
        // Iron - metallic look
        ctx.fillRect(-7, -60, 14, 120);

        // Metallic shine
        const gradient = ctx.createLinearGradient(-7, 0, 7, 0);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(-7, -60, 14, 120);
    }

    ctx.restore();

    // Draw mode label
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(config.name, centerX, centerY - 120);
}

function drawCotton() {
    const cottonItem = items.find(i => i.id === 'cotton');
    if (cottonItem.placed && !state.fireLit) {
        // Draw cotton at contact point
        ctx.fillStyle = cottonItem.color;
        ctx.beginPath();
        ctx.ellipse(centerX, spindleContactY, 30, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cotton texture
        ctx.fillStyle = '#E8E8D8';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * 15;
            const y = spindleContactY + Math.sin(angle) * 10;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
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

// Animation loop
let lastTime = Date.now();

function animate() {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    update(deltaTime);

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
