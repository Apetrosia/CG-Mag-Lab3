const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
    alert("WebGL2 not supported");
}

function resizeCanvas() {
    canvas.height = window.innerHeight;
    canvas.width = window.innerWidth;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ================== ПОВОРОТ ==================

let anglex = 0
let angley = 0
let anglez = 0
let scalex = 1
let scaley = 1
let scalez = 1
let tx = 0
let ty = 0
let tz = 0

function createTransformMatrix(
    angleX = 0,
    angleY = 0,
    angleZ = 0,
    scalex = 1,
    scaley = 1,
    scalez = 1,
    tx = 0,
    ty = 0,
    tz = 0
) {

    const cx = Math.cos(angleX);
    const sx = Math.sin(angleX);

    const cy = Math.cos(angleY);
    const sy = Math.sin(angleY);

    const cz = Math.cos(angleZ);
    const sz = Math.sin(angleZ);

    // Rotation X
    const rx = new Float32Array([
        1, 0, 0, 0,
        0, cx, sx, 0,
        0, -sx, cx, 0,
        0, 0, 0, 1
    ]);

    // Rotation Y
    const ry = new Float32Array([
        cy, 0, -sy, 0,
        0, 1, 0, 0,
        sy, 0, cy, 0,
        0, 0, 0, 1
    ]);

    // Rotation Z
    const rz = new Float32Array([
        cz, sz, 0, 0,
        -sz, cz, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);

    // Scale
    const s = new Float32Array([
        scalex, 0, 0, 0,
        0, scaley, 0, 0,
        0, 0, scalez, 0,
        0, 0, 0, 1
    ]);

    function multiply(a, b) {
        const out = new Float32Array(16);

        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                out[col * 4 + row] =
                    a[0 * 4 + row] * b[col * 4 + 0] +
                    a[1 * 4 + row] * b[col * 4 + 1] +
                    a[2 * 4 + row] * b[col * 4 + 2] +
                    a[3 * 4 + row] * b[col * 4 + 3];
            }
        }

        return out;
    }

    // R = Rz * Ry * Rx
    const rxy = multiply(ry, rx);
    const rxyz = multiply(rz, rxy);

    // RS = R * S
    const rs = multiply(rxyz, s);

    // Добавляем трансляцию (последний столбец)
    rs[12] = tx;
    rs[13] = ty;
    rs[14] = tz;
    rs[15] = 1;

    return rs;
}

function createPerspectiveMatrix(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);

    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, (2 * far * near) * nf, 0
    ]);
}

// ================== ШЕЙДЕРЫ ==================

const vsSource = `#version 300 es
in vec3 aPosition;
in vec3 aColor;

uniform mat4 uModel;
uniform mat4 uProjection;

out vec3 vColor;

void main() {
    gl_Position = uProjection * uModel * vec4(aPosition, 1.0);
    vColor = aColor;
}
`;

const fsSource = `#version 300 es
precision mediump float;

in vec3 vColor;
out vec4 outColor;

void main() {
    outColor = vec4(vColor, 1.0);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }

    return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
}

gl.useProgram(program);

// ================== ГЕОМЕТРИЯ ==================

const vertices = new Float32Array([
  -0.5,-0.5, 0.5,   1,0,0,
   0.5,-0.5, 0.5,   0,1,0,
   0.5, 0.5, 0.5,   0,0,1,
  -0.5, 0.5, 0.5,   1,1,0,

  -0.5,-0.5,-0.5,   1,0,1,
   0.5,-0.5,-0.5,   0,1,1,
   0.5, 0.5,-0.5,   1,1,1,
  -0.5, 0.5,-0.5,   0,0,0,
]);

const indices = new Uint16Array([
  0,1,2, 0,2,3,
  4,5,6, 4,6,7,
  0,1,5, 0,5,4,
  2,3,7, 2,7,6,
  1,2,6, 1,6,5,
  0,3,7, 0,7,4
]);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const ebo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

const posLoc = gl.getAttribLocation(program, "aPosition");
const colorLoc = gl.getAttribLocation(program, "aColor");

gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 6 * 4, 0);

gl.enableVertexAttribArray(colorLoc);
gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 6 * 4, 3 * 4);

document.addEventListener("keydown", (e) => {
    if (e.key === "w" || e.key === "W") anglex += 0.02;
    if (e.key === "s" || e.key === "S") anglex -= 0.02;
    if (e.key === "d" || e.key === "D") angley += 0.02;
    if (e.key === "a" || e.key === "A") angley -= 0.02;
    if (e.key === "q" || e.key === "Q") anglez += 0.02;
    if (e.key === "e" || e.key === "E") anglez -= 0.02;
    
});

const rotationLoc = gl.getUniformLocation(program, "uRotation");
const modelLoc = gl.getUniformLocation(program, "uModel");
const projectionLoc = gl.getUniformLocation(program, "uProjection");

gl.enable(gl.DEPTH_TEST);

// ================== РЕНДЕР ==================

function render() {
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.width / canvas.height;

    const projection = createPerspectiveMatrix(
        Math.PI / 4,  // 45°
        aspect,
        0.1,
        100
    );

    const model = createTransformMatrix(
        anglex,
        angley,
        anglez,
        scalex,
        scaley,
        scalez,
        0, 0, -4   // ← ВАЖНО! Отодвигаем куб назад
    );

    gl.uniformMatrix4fv(modelLoc, false, model);
    gl.uniformMatrix4fv(projectionLoc, false, projection);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(render);
}

render();