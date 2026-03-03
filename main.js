const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
    alert("WebGL2 not supported");
}

// ================== ШЕЙДЕРЫ ==================

const vsSource = `#version 300 es
in vec3 aPosition;
in vec3 aColor;

uniform mat4 uRotation;

out vec3 vColor;

void main() {
    gl_Position = uRotation * vec4(aPosition, 1.0);
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

// ================== ПОВОРОТ ==================

let angle = 0;

function getRotationYMatrix(a) {
    const c = Math.cos(a);
    const s = Math.sin(a);

    return new Float32Array([
        c, 0, -s, 0,
        0, 1,  0, 0,
        s, 0,  c, 0,
        0, 0,  0, 1
    ]);
}

document.addEventListener("keydown", (e) => {
    if (e.key === "a" || e.key === "A") angle -= 0.1;
    if (e.key === "d" || e.key === "D") angle += 0.1;
});

const rotationLoc = gl.getUniformLocation(program, "uRotation");

gl.enable(gl.DEPTH_TEST);

// ================== РЕНДЕР ==================

function render() {
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const rotMatrix = getRotationYMatrix(angle);
    gl.uniformMatrix4fv(rotationLoc, false, rotMatrix);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(render);
}

render();