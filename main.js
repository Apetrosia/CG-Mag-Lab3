const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

if (!gl) alert("WebGL2 not supported");

function resizeCanvas(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0,0,canvas.width,canvas.height);
}

window.addEventListener("resize",resizeCanvas);
resizeCanvas();

gl.enable(gl.DEPTH_TEST);

let anglex = 0;
let angley = 0;
let anglez = 0;

let scalex = 1;
let scaley = 1;
let scalez = 1;

function createTransformMatrix(ax,ay,az,sx,sy,sz,tx,ty,tz){

    const cx=Math.cos(ax), sx_=Math.sin(ax);
    const cy=Math.cos(ay), sy_=Math.sin(ay);
    const cz=Math.cos(az), sz_=Math.sin(az);

    const rx=[
        1,0,0,0,
        0,cx,sx_,0,
        0,-sx_,cx,0,
        0,0,0,1
    ];

    const ry=[
        cy,0,-sy_,0,
        0,1,0,0,
        sy_,0,cy,0,
        0,0,0,1
    ];

    const rz=[
        cz,sz_,0,0,
        -sz_,cz,0,0,
        0,0,1,0,
        0,0,0,1
    ];

    const s=[
        sx,0,0,0,
        0,sy,0,0,
        0,0,sz,0,
        0,0,0,1
    ];

    function mul(a,b){

        const r=new Float32Array(16);

        for(let c=0;c<4;c++)
        for(let r0=0;r0<4;r0++){

            r[c*4+r0]=
            a[0*4+r0]*b[c*4+0]+
            a[1*4+r0]*b[c*4+1]+
            a[2*4+r0]*b[c*4+2]+
            a[3*4+r0]*b[c*4+3];
        }

        return r;
    }

    let m=mul(rz,mul(ry,rx));
    m=mul(m,s);

    m[12]=tx;
    m[13]=ty;
    m[14]=tz;
    m[15]=1;

    return m;
}

function createPerspectiveMatrix(fov,aspect,near,far){

    const f=1/Math.tan(fov/2);
    const nf=1/(near-far);

    return new Float32Array([
        f/aspect,0,0,0,
        0,f,0,0,
        0,0,(far+near)*nf,-1,
        0,0,(2*far*near)*nf,0
    ]);
}

const vs=`#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uProjection;

out vec3 vPos;
out vec3 vNormal;

void main(){
    vec4 worldPos = uModel * vec4(aPosition,1.0);
    vPos = worldPos.xyz;
    vNormal = normalize(mat3(uModel) * aNormal); // или transpose(inverse(uModel)) если будут неравномерные масштабы
    gl_Position = uProjection * worldPos;
}`;

const fs=`#version 300 es
precision mediump float;

in vec3 vPos;
in vec3 vNormal;

out vec4 outColor;

uniform vec3 uLightPos;
uniform float uAmbientPower;
uniform int uUsePhong; // 1 = Phong, 0 = Lambert
uniform vec3 uBaseColor; // базовый цвет для модели

void main(){
    vec3 ambient = uAmbientPower * uBaseColor;
    vec3 lightDir = normalize(uLightPos - vPos);
    float diff = max(dot(vNormal, lightDir), 0.0);
    vec3 diffuse = diff * uBaseColor;

    vec3 color;

    if(uUsePhong == 1){
        vec3 viewDir = normalize(-vPos);
        vec3 reflectDir = reflect(-lightDir,vNormal);
        float spec = pow(max(dot(viewDir,reflectDir),0.0),32.0);
        vec3 specular = spec * vec3(1.0);
        color = ambient + diffuse + specular;
    } else {
        color = ambient + diffuse;
    }

    outColor = vec4(color,1.0);
}`;

function createShader(type,src){

    const s=gl.createShader(type);
    gl.shaderSource(s,src);
    gl.compileShader(s);

    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))
        console.error(gl.getShaderInfoLog(s));

    return s;
}

const program=gl.createProgram();
gl.attachShader(program,createShader(gl.VERTEX_SHADER,vs));
gl.attachShader(program,createShader(gl.FRAGMENT_SHADER,fs));
gl.linkProgram(program);

gl.useProgram(program);

const modelLoc=gl.getUniformLocation(program,"uModel");
const projLoc=gl.getUniformLocation(program,"uProjection");

async function loadOBJ(url){

    const res=await fetch(url);
    const text=await res.text();

    const lines=text.split("\n");

    const pos=[];
    const nor=[];
    const uv=[];

    const vertices=[];
    const indices=[];
    const map=new Map();

    function getIndex(v,vt,vn){

        const key=`${v}/${vt}/${vn}`;
        if(map.has(key)) return map.get(key);

        const px=pos[v*3];
        const py=pos[v*3+1];
        const pz=pos[v*3+2];

        let nx = 0, ny = 0, nz = 1;

        if (vn >= 0) {
            nx = nor[vn*3];
            ny = nor[vn*3+1];
            nz = nor[vn*3+2];
        }

        const u=vt>=0?uv[vt*2]:0;
        const vcoord=vt>=0?uv[vt*2+1]:0;

        vertices.push(px,py,pz,nx,ny,nz,u,vcoord);

        const id=vertices.length/8-1;
        map.set(key,id);

        return id;
    }

    for(let l of lines){

        l=l.trim();
        if(l==""||l.startsWith("#")) continue;

        const p=l.split(/\s+/);

        if(p[0]=="v")
            pos.push(+p[1],+p[2],+p[3]);

        else if(p[0]=="vn")
            nor.push(+p[1],+p[2],+p[3]);

        else if(p[0]=="vt")
            uv.push(+p[1],+p[2]);

        else if(p[0]=="f"){

            const face=[];

            for(let i=1;i<p.length;i++){

                const t=p[i].split("/");
                const v=parseInt(t[0])-1;
                const vt=t[1]?parseInt(t[1])-1:-1;
                const vn=t[2]?parseInt(t[2])-1:-1;

                face.push(getIndex(v,vt,vn));
            }

            for(let i=1;i<face.length-1;i++)
                indices.push(face[0],face[i],face[i+1]);
        }
    }

    return{
        vertices:new Float32Array(vertices),
        indices:new Uint32Array(indices)
    };
}

function createMesh(data){

    const vao=gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferData(gl.ARRAY_BUFFER,data.vertices,gl.STATIC_DRAW);

    const ebo=gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);

    const stride=8*4;

    const posLoc=gl.getAttribLocation(program,"aPosition");
    const normLoc=gl.getAttribLocation(program,"aNormal");
    const uvLoc=gl.getAttribLocation(program,"aTexCoord");

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,stride,0);

    gl.enableVertexAttribArray(normLoc);
    gl.vertexAttribPointer(normLoc,3,gl.FLOAT,false,stride,3*4);

    if (uvLoc >= 0) {
        gl.enableVertexAttribArray(uvLoc);
        gl.vertexAttribPointer(uvLoc,2,gl.FLOAT,false,stride,6*4);
    }

    return{
        vao:vao,
        count:data.indices.length
    };
}

let objects = [];

async function init(){

    const snowman = await loadOBJ("./models/snowman.obj");
    const Sherlock = await loadOBJ("./models/Sherlock.obj");
    const bananaCat = await loadOBJ("./models/bananaCat.obj");

    objects.push({
        mesh: createMesh(snowman),
        tx: 0,
        ty: -0.3,
        tz: -5,
        scale: 0.3
    });

    objects.push({
        mesh: createMesh(Sherlock),
        tx: -1.5,
        ty: -0.4,
        tz: -4,
        scale: 3
    });

    objects.push({
        mesh: createMesh(bananaCat),
        tx: 3,
        ty: -0.7,
        tz: -7,
        scale: 0.5
    });

    requestAnimationFrame(render);
}

const lightLoc = gl.getUniformLocation(program,"uLightPos");
const ambientLoc = gl.getUniformLocation(program,"uAmbientPower");
const phongLoc = gl.getUniformLocation(program,"uUsePhong");

const baseColorLoc = gl.getUniformLocation(program,"uBaseColor");
let usePhong = 1;
gl.uniform1i(phongLoc,usePhong);

// изначальный цвет белый
let baseColor = [1.0,1.0,1.0];
gl.uniform3fv(baseColorLoc, baseColor);

document.addEventListener("keydown",(e)=>{
    if(e.key=="w") anglex+=0.05;
    if(e.key=="s") anglex-=0.05;
    if(e.key=="a") angley-=0.05;
    if(e.key=="d") angley+=0.05;
    if(e.key=="l" || e.key=="L") {
        usePhong = 1 - usePhong;
        gl.uniform1i(phongLoc,usePhong);

        // случайный цвет
        baseColor = [Math.random(), Math.random(), Math.random()];
        gl.uniform3fv(baseColorLoc, baseColor);

        console.log("Lighting mode:", usePhong ? "Phong" : "Lambert", "Color:", baseColor);
    }
});

function render(){

    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

    const aspect=canvas.width/canvas.height;

    const projection=createPerspectiveMatrix(
        Math.PI/4,
        aspect,
        0.1,
        100
    );

    gl.uniformMatrix4fv(projLoc,false,projection);

    for (const obj of objects) {

    const model = createTransformMatrix(
        anglex,
        angley,
        anglez,
        obj.scale,
        obj.scale,
        obj.scale,
        obj.tx,
        obj.ty,
        obj.tz
    );

    gl.uniformMatrix4fv(modelLoc,false,model);
    gl.bindVertexArray(obj.mesh.vao);

    gl.drawElements(
        gl.TRIANGLES,
        obj.mesh.count,
        gl.UNSIGNED_INT,
        0
    );
}

    requestAnimationFrame(render);
}

init();