import {defs, tiny} from './common.js';
// Pull these names into this module's scope for convenience:
const {vec3, vec4, vec, color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;
const {Cube, Axis_Arrows, Textured_Phong, Phong_Shader, Basic_Shader, Subdivision_Sphere} = defs

export class Shape_From_File extends Shape {                                   // **Shape_From_File** is a versatile standalone Shape that imports
                                                                               // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) {                             // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then(response => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                this.copy_onto_graphics_card(this.gl);
            })
    }

    parse_into_mesh(data) {                           // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/;
        var NORMAL_RE = /^vn\s/;
        var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;
        var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split('/');

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const {verts, norms, textures} = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready)
            super.draw(context, program_state, model_transform, material);
    }
}

const LIGHT_DEPTH_TEX_SIZE = 2048;

const Square =
    class Square extends tiny.Vertex_Buffer {
        // **Minimal_Shape** an even more minimal triangle, with three
        // vertices each holding a 3D position and a color.
        constructor() {
            super("position", "normal", "texture_coord");
            this.arrays.position = [
                vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, 1, 0),
                vec3(1, 1, 0), vec3(1, 0, 0), vec3(0, 1, 0)
            ];
            this.arrays.normal = [
                vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1),
                vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1),
            ];
            this.arrays.texture_coord = [
                vec(0, 0), vec(1, 0), vec(0, 1),
                vec(1, 1), vec(1, 0), vec(0, 1)
            ]
        }
    }

export class Shadow_Demo extends Scene {                           // **Obj_File_Demo** show how to load a single 3D model from an OBJ file.
                                                                     // Detailed model files can be used in place of simpler primitive-based
                                                                     // shapes to add complexity to a scene.  Simpler primitives in your scene
                                                                     // can just be thought of as placeholders until you find a model file
                                                                     // that fits well.  This demo shows the teapot model twice, with one
                                                                     // teapot showing off the Fake_Bump_Map effect while the other has a
                                                                     // regular texture and Phong lighting.
    constructor() {
        super();
        // Load the model file:
        this.shapes = {
            "teapot": new Shape_From_File("assets/teapot.obj"),
            "sphere": new Subdivision_Sphere(6),
            "cube": new Cube(),
            "square_2d": new Square(),
        };

        // // Don't create any DOM elements to control this scene:
        // this.widget_options = {make_controls: false};
        // Non bump mapped:
        this.stars = new Material(new Shadow_Textured_Phong(1), {
            color: color(.5, .5, .5, 1),
            ambient: .3, diffusivity: .5, specularity: .5,
            color_texture: new Texture("assets/stars.png"),
            light_depth_texture: null

        });
        // For the floor
        this.floor = new Material(new Shadow_Textured_Phong(1), {
            color: color(1, 1, 1, 1), ambient: .4, diffusivity: 0.5, specularity: 0.4, smoothness: 64,
            color_texture: null,
            light_depth_texture: null
        })
        // For the floor
        this.pure = new Material(new Color_Phong_Shader(), {
        })
        // For light source
        this.light_src = new Material(new Phong_Shader(), {
            color: color(1, 1, 1, 1), ambient: 1, diffusivity: 0, specularity: 0
        });
        // For depth texture display
        this.depth_tex =  new Material(new Depth_Texture_Shader_2D(), {
            color: color(0, 0, .0, 1),
            ambient: 1, diffusivity: 0, specularity: 0, texture: null
        });

        this.init_ok = false;
    }

    make_control_panel() {
        // make_control_panel(): Sets up a panel of interactive HTML elements, including
        // buttons with key bindings for affecting this scene, and live info readouts.
        this.control_panel.innerHTML += "Dragonfly rotation angle: ";
        // The next line adds a live text readout of a data member of our Scene.
        this.live_string(box => {
            box.textContent = (this.hover ? 0 : (this.t % (2 * Math.PI)).toFixed(2)) + " radians"
        });
        this.new_line();
        this.new_line();
        // Add buttons so the user can actively toggle data members of our Scene:
        this.key_triggered_button("Hover dragonfly in place", ["h"], function () {
            this.hover ^= 1;
        });
        this.new_line();
        this.key_triggered_button("Swarm mode", ["m"], function () {
            this.swarm ^= 1;
        });
    }

    texture_buffer_init(gl) {
        // Depth Texture
        this.lightDepthTexture = gl.createTexture();
        // Bind it to TinyGraphics
        this.light_depth_texture = new Buffered_Texture(this.lightDepthTexture);
        this.stars.light_depth_texture = this.light_depth_texture
        this.floor.light_depth_texture = this.light_depth_texture

        this.lightDepthTextureSize = LIGHT_DEPTH_TEX_SIZE;
        gl.bindTexture(gl.TEXTURE_2D, this.lightDepthTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,      // target
            0,                  // mip level
            gl.DEPTH_COMPONENT, // internal format
            this.lightDepthTextureSize,   // width
            this.lightDepthTextureSize,   // height
            0,                  // border
            gl.DEPTH_COMPONENT, // format
            gl.UNSIGNED_INT,    // type
            null);              // data
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Depth Texture Buffer
        this.lightDepthFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,       // target
            gl.DEPTH_ATTACHMENT,  // attachment point
            gl.TEXTURE_2D,        // texture target
            this.lightDepthTexture,         // texture
            0);                   // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // create a color texture of the same size as the depth texture
        // see article why this is needed_
        this.unusedTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.unusedTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this.lightDepthTextureSize,
            this.lightDepthTextureSize,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // attach it to the framebuffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,        // target
            gl.COLOR_ATTACHMENT0,  // attachment point
            gl.TEXTURE_2D,         // texture target
            this.unusedTexture,         // texture
            0);                    // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    render_scene(context, program_state, shadow_pass, draw_light_source=false, draw_shadow=false) {
        let light_position = this.light_position;
        let light_color = this.light_color;
        const t = program_state.animation_time;

        program_state.draw_shadow = draw_shadow;

        if (draw_light_source && shadow_pass) {
            this.shapes.sphere.draw(context, program_state,
                Mat4.translation(light_position[0], light_position[1], light_position[2]).times(Mat4.scale(.5,.5,.5)),
                this.light_src.override({color: light_color}));
        }

        for (let i of [-1, 1]) { // Spin the 3D model shapes as well.
            const model_transform = Mat4.translation(2 * i, 3, 0)
                .times(Mat4.rotation(t / 1000, -1, 2, 0))
                .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0));
            this.shapes.teapot.draw(context, program_state, model_transform, shadow_pass? this.stars : this.pure);
        }

        let model_trans_floor = Mat4.scale(8, 0.1, 5);
        let model_trans_ball_0 = Mat4.translation(0, 1, 0);
        let model_trans_ball_1 = Mat4.translation(5, 1, 0);
        let model_trans_ball_2 = Mat4.translation(-5, 1, 0);
        let model_trans_ball_3 = Mat4.translation(0, 1, 3);
        let model_trans_ball_4 = Mat4.translation(0, 1, -3);
        let model_trans_wall_1 = Mat4.translation(-8, 2 - 0.1, 0).times(Mat4.scale(0.33, 2, 5));
        let model_trans_wall_2 = Mat4.translation(+8, 2 - 0.1, 0).times(Mat4.scale(0.33, 2, 5));
        let model_trans_wall_3 = Mat4.translation(0, 2 - 0.1, -5).times(Mat4.scale(8, 2, 0.33));
        this.shapes.cube.draw(context, program_state, model_trans_floor, shadow_pass? this.floor : this.pure);
        this.shapes.cube.draw(context, program_state, model_trans_wall_1, shadow_pass? this.floor : this.pure);
        this.shapes.cube.draw(context, program_state, model_trans_wall_2, shadow_pass? this.floor : this.pure);
        this.shapes.cube.draw(context, program_state, model_trans_wall_3, shadow_pass? this.floor : this.pure);
        this.shapes.sphere.draw(context, program_state, model_trans_ball_0, shadow_pass? this.floor : this.pure);
        this.shapes.sphere.draw(context, program_state, model_trans_ball_1, shadow_pass? this.floor : this.pure);
        this.shapes.sphere.draw(context, program_state, model_trans_ball_2, shadow_pass? this.floor : this.pure);
        this.shapes.sphere.draw(context, program_state, model_trans_ball_3, shadow_pass? this.floor : this.pure);
        this.shapes.sphere.draw(context, program_state, model_trans_ball_4, shadow_pass? this.floor : this.pure);
    }

    display(context, program_state) {
        const t = program_state.animation_time;
        const gl = context.context;

        if (!this.init_ok) {
            const ext = gl.getExtension('WEBGL_depth_texture');
            if (!ext) {
                return alert('need WEBGL_depth_texture');  // eslint-disable-line
            }
            this.texture_buffer_init(gl);

            this.init_ok = true;
        }

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(Mat4.look_at(
                vec3(0, 12, 12),
                vec3(0, 2, 0),
                vec3(0, 1, 0)
            )); // Locate the camera here
        }

        // The position of the light
        this.light_position = Mat4.rotation(t / 1500, 0, 1, 0).times(vec4(3, 6, 0, 1));
        // The color of the light
        this.light_color = color(
            0.667 + Math.sin(t/500) / 3,
            0.667 + Math.sin(t/1500) / 3,
            0.667 + Math.sin(t/3500) / 3,
            1
        );

        // This is a rough target of the light.
        // Although the light is point light, we need a target to set the POV of the light
        this.light_view_target = vec4(0, 0, 0, 1);
        this.light_field_of_view = 130 * Math.PI / 180; // 130 degree

        program_state.lights = [new Light(this.light_position, this.light_color, 1000)];

        // Step 1: set the perspective and camera to the POV of light
        const light_view_mat = Mat4.look_at(
            vec3(this.light_position[0], this.light_position[1], this.light_position[2]),
            vec3(this.light_view_target[0], this.light_view_target[1], this.light_view_target[2]),
        vec3(0, 1, 0), // assume the light to target will have a up dir of +y, maybe need to change according to your case
        );
        const light_proj_mat = Mat4.perspective(this.light_field_of_view, 1, 0.5, 500);
        // Bind the Depth Texture Buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
        gl.viewport(0, 0, this.lightDepthTextureSize, this.lightDepthTextureSize);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Prepare uniforms
        program_state.light_view_mat = light_view_mat;
        program_state.light_proj_mat = light_proj_mat;
        program_state.light_tex_mat = light_proj_mat;
        program_state.view_mat = light_view_mat;
        program_state.projection_transform = light_proj_mat;
        this.render_scene(context, program_state, false,false, false);

        // Step 2: unbind, draw to the canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        program_state.view_mat = program_state.camera_inverse;
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 0.5, 500);
        this.render_scene(context, program_state, true,true, true);

        // Step 3: display the textures
        this.shapes.square_2d.draw(context, program_state,
            Mat4.translation(-.99, .08, 0).times(
            Mat4.scale(0.5, 0.5 * gl.canvas.width / gl.canvas.height, 1)
            ),
            this.depth_tex.override({texture: this.lightDepthTexture})
        );
    }

    // show_explanation(document_element) {
    //     document_element.innerHTML += "<p>This demo loads an external 3D model file of a teapot.  It uses a condensed version of the \"webgl-obj-loader.js\" "
    //         + "open source library, though this version is not guaranteed to be complete and may not handle some .OBJ files.  It is contained in the class \"Shape_From_File\". "
    //         + "</p><p>One of these teapots is lit with bump mapping.  Can you tell which one?</p>";
    // }
}


const Shadow_Textured_Phong =
    class Shadow_Textured_Phong extends defs.Phong_Shader {
        shared_glsl_code() {
            // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
            return ` precision mediump float;
                const int N_LIGHTS = ` + this.num_lights + `;
                uniform float ambient, diffusivity, specularity, smoothness;
                uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
                uniform float light_attenuation_factors[N_LIGHTS];
                uniform vec4 shape_color;
                uniform vec3 squared_scale, camera_center;
        
                // Specifier "varying" means a variable's final value will be passed from the vertex shader
                // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
                // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
                varying vec3 N, vertex_worldspace;
                // ***** PHONG SHADING HAPPENS HERE: *****                                       
                vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
                    // phong_model_lights():  Add up the lights' contributions.
                    vec3 E = normalize( camera_center - vertex_worldspace );
                    vec3 result = vec3( 0.0 );
                    for(int i = 0; i < N_LIGHTS; i++){
                        // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                        // light will appear directional (uniform direction from all points), and we 
                        // simply obtain a vector towards the light by directly using the stored value.
                        // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                        // the point light's location from the current surface point.  In either case, 
                        // fade (attenuate) the light as the vector needed to reach it gets longer.  
                        vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                                       light_positions_or_vectors[i].w * vertex_worldspace;                                             
                        float distance_to_light = length( surface_to_light_vector );
        
                        vec3 L = normalize( surface_to_light_vector );
                        vec3 H = normalize( L + E );
                        // Compute the diffuse and specular components from the Phong
                        // Reflection Model, using Blinn's "halfway vector" method:
                        float diffuse  =      max( dot( N, L ), 0.0 );
                        float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                        float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                        
                        vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                                  + light_colors[i].xyz * specularity * specular;
                        result += attenuation * light_contribution;
                      }
                    return result;
                  } `;
        }
        vertex_glsl_code() {
            // ********* VERTEX SHADER *********
            return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                attribute vec3 position, normal;                            
                // Position is expressed in object coordinates.
                attribute vec2 texture_coord;
                
                uniform mat4 model_transform;
                uniform mat4 projection_camera_model_transform;
        
                void main(){                                                                   
                    // The vertex's final resting place (in NDCS):
                    gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                    // The final normal vector in screen space.
                    N = normalize( mat3( model_transform ) * normal / squared_scale);
                    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                    // Turn the per-vertex texture coordinate into an interpolated variable.
                    f_tex_coord = texture_coord;
                  } `;
        }

        fragment_glsl_code() {
            // ********* FRAGMENT SHADER *********
            // A fragment is a pixel that's overlapped by the current triangle.
            // Fragments affect the final image or get discarded due to depth.
            return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                uniform sampler2D texture;
                uniform sampler2D light_depth_texture;
                uniform mat4 light_view_mat;
                uniform mat4 light_proj_mat;
                uniform float animation_time;
                uniform float light_depth_bias;
                uniform bool use_texture;
                uniform bool draw_shadow;
                uniform float light_texture_size;
                
                float PCF_shadow(vec2 center, float projected_depth) {
                    float shadow = 0.0;
                    float texel_size = 1.0 / light_texture_size;
                    for(int x = -1; x <= 1; ++x)
                    {
                        for(int y = -1; y <= 1; ++y)
                        {
                            float light_depth_value = texture2D(light_depth_texture, center + vec2(x, y) * texel_size).r; 
                            shadow += projected_depth >= light_depth_value + light_depth_bias ? 1.0 : 0.0;        
                        }    
                    }
                    shadow /= 9.0;
                    return shadow;
                }
                
                void main(){
                    // Sample the texture image in the correct place:
                    vec4 tex_color = texture2D( texture, f_tex_coord );
                    if (!use_texture)
                        tex_color.xyz = vec3(0, 0, 0);
                    if( tex_color.w < .01 ) discard;
                                                                             // Compute an initial (ambient) color:
                    gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                             // Compute the final color with contributions from lights:
                    vec3 other_than_ambient = phong_model_lights( normalize( N ), vertex_worldspace );
                    
                    if (draw_shadow) {
                        vec4 light_tex_coord = (light_proj_mat * light_view_mat * vec4(vertex_worldspace, 1.0));
                        // convert NDCS from light's POV to light depth texture coordinates
                        light_tex_coord.xyz /= light_tex_coord.w; 
                        light_tex_coord.xyz *= 0.5;
                        light_tex_coord.xyz += 0.5;
                        float light_depth_value = texture2D( light_depth_texture, light_tex_coord.xy ).r;
                        float projected_depth = light_tex_coord.z;
                        
                        bool inRange =
                            light_tex_coord.x >= 0.0 &&
                            light_tex_coord.x <= 1.0 &&
                            light_tex_coord.y >= 0.0 &&
                            light_tex_coord.y <= 1.0;
                              
                        float shadowness = PCF_shadow(light_tex_coord.xy, projected_depth);
                        
                        if (inRange && shadowness > 0.3) {
                            other_than_ambient.xyz *= 0.3 + 0.7 * (1.0 - shadowness);
                        }
                    }
                    
                    gl_FragColor.xyz += other_than_ambient;
                } `;
        }

        send_gpu_state(gl, gpu, gpu_state, model_transform) {
            // send_gpu_state():  Send the state of our whole drawing context to the GPU.
            const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
            gl.uniform3fv(gpu.camera_center, camera_center);
            // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
            const squared_scale = model_transform.reduce(
                (acc, r) => {
                    return acc.plus(vec4(...r).times_pairwise(r))
                }, vec4(0, 0, 0, 0)).to3();
            gl.uniform3fv(gpu.squared_scale, squared_scale);
            // Send the current matrices to the shader.  Go ahead and pre-compute
            // the products we'll need of the of the three special matrices and just
            // cache and send those.  They will be the same throughout this draw
            // call, and thus across each instance of the vertex shader.
            // Transpose them since the GPU expects matrices as column-major arrays.
            const PCM = gpu_state.projection_transform.times(gpu_state.view_mat).times(model_transform);
            gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
            gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));
            // shadow related
            gl.uniformMatrix4fv(gpu.light_view_mat, false, Matrix.flatten_2D_to_1D(gpu_state.light_view_mat.transposed()));
            gl.uniformMatrix4fv(gpu.light_proj_mat, false, Matrix.flatten_2D_to_1D(gpu_state.light_proj_mat.transposed()));

            // Omitting lights will show only the material color, scaled by the ambient term:
            if (!gpu_state.lights.length)
                return;

            const light_positions_flattened = [], light_colors_flattened = [];
            for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
                light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
                light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
            }
            gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
            gl.uniform4fv(gpu.light_colors, light_colors_flattened);
            gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
        }

        update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
            // update_GPU(): Add a little more to the base class's version of this method.
            super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
            // Updated for assignment 4
            context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
            if (material.color_texture && material.color_texture.ready) {
                // Select texture unit 0 for the fragment shader Sampler2D uniform called "texture":
                context.uniform1i(gpu_addresses.color_texture, 0); // 0 for color texture
                // For this draw, use the texture image from correct the GPU buffer:
                context.activeTexture(context["TEXTURE" + 0]);
                material.color_texture.activate(context);
                context.uniform1i(gpu_addresses.use_texture, 1);
            }
            else {
                context.uniform1i(gpu_addresses.use_texture, 0);
            }
            if (gpu_state.draw_shadow) {
                context.uniform1i(gpu_addresses.draw_shadow, 1);
                context.uniform1f(gpu_addresses.light_depth_bias, 0.003);
                context.uniform1f(gpu_addresses.light_texture_size, LIGHT_DEPTH_TEX_SIZE);
                context.uniform1i(gpu_addresses.light_depth_texture, 1); // 1 for light-view depth texture}
                if (material.light_depth_texture && material.light_depth_texture.ready) {
                    context.activeTexture(context["TEXTURE" + 1]);
                    material.light_depth_texture.activate(context, 1);
                }
            }
            else {
                context.uniform1i(gpu_addresses.draw_shadow, 0);
            }
        }
    }



const Color_Phong_Shader =
    class Color_Phong_Shader extends defs.Phong_Shader {
        vertex_glsl_code() {
            // ********* VERTEX SHADER *********
            return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                attribute vec3 position, normal;                            
                // Position is expressed in object coordinates.
                attribute vec2 texture_coord;
                
                uniform mat4 model_transform;
                uniform mat4 projection_camera_model_transform;
        
                void main(){                                                                   
                    // The vertex's final resting place (in NDCS):
                    gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                    // The final normal vector in screen space.
                    N = normalize( mat3( model_transform ) * normal / squared_scale);
                    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                    // Turn the per-vertex texture coordinate into an interpolated variable.
                    f_tex_coord = texture_coord;
                  } `;
        }

        fragment_glsl_code() {
            // ********* FRAGMENT SHADER *********
            // A fragment is a pixel that's overlapped by the current triangle.
            // Fragments affect the final image or get discarded due to depth.
            return this.shared_glsl_code() + `
                uniform sampler2D texture;
                uniform sampler2D light_depth_texture;
                uniform mat4 light_view_mat;
                uniform mat4 light_proj_mat;
                
                void main(){
                    gl_FragColor = vec4( (shape_color.xyz ) * ambient, shape_color.w ); 
                                                                             // Compute the final color with contributions from lights:
                    gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
                  } `;
        }

        send_gpu_state(gl, gpu, gpu_state, model_transform) {
            // send_gpu_state():  Send the state of our whole drawing context to the GPU.
            const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
            gl.uniform3fv(gpu.camera_center, camera_center);
            // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
            const squared_scale = model_transform.reduce(
                (acc, r) => {
                    return acc.plus(vec4(...r).times_pairwise(r))
                }, vec4(0, 0, 0, 0)).to3();
            gl.uniform3fv(gpu.squared_scale, squared_scale);
            // Send the current matrices to the shader.  Go ahead and pre-compute
            // the products we'll need of the of the three special matrices and just
            // cache and send those.  They will be the same throughout this draw
            // call, and thus across each instance of the vertex shader.
            // Transpose them since the GPU expects matrices as column-major arrays.
            const PCM = gpu_state.projection_transform.times(gpu_state.view_mat).times(model_transform);
            gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
            gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));
            // shadow related
            gl.uniformMatrix4fv(gpu.light_view_mat, false, Matrix.flatten_2D_to_1D(gpu_state.light_view_mat.transposed()));
            gl.uniformMatrix4fv(gpu.light_proj_mat, false, Matrix.flatten_2D_to_1D(gpu_state.light_proj_mat.transposed()));

            // Omitting lights will show only the material color, scaled by the ambient term:
            if (!gpu_state.lights.length)
                return;

            const light_positions_flattened = [], light_colors_flattened = [];
            for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
                light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
                light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
            }
            gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
            gl.uniform4fv(gpu.light_colors, light_colors_flattened);
            gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
        }

        update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
            // update_GPU(): Add a little more to the base class's version of this method.
            super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
            // Updated for assignment 4
            context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
        }
    }


const Depth_Texture_Shader_2D =
    class Depth_Texture_Shader extends Phong_Shader {
        // **Textured_Phong** is a Phong Shader extended to addditionally decal a
        // texture image over the drawn shape, lined up according to the texture
        // coordinates that are stored at each shape vertex.

        vertex_glsl_code() {
            // ********* VERTEX SHADER *********
            return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                attribute vec3 position, normal;                            
                // Position is expressed in object coordinates.
                attribute vec2 texture_coord;
                
                uniform mat4 model_transform;
                uniform mat4 projection_camera_model_transform;
        
                void main(){                                                                   
                    // The vertex's final resting place (in NDCS):
                    gl_Position = model_transform * vec4( position.xy, -1, 1.0 ); // <== only Model, no View
                    // The final normal vector in screen space.
                    N = normalize( mat3( model_transform ) * normal / squared_scale);
                    vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                    // Turn the per-vertex texture coordinate into an interpolated variable.
                    f_tex_coord = texture_coord;
                  } `;
        }

        fragment_glsl_code() {
            // ********* FRAGMENT SHADER *********
            // A fragment is a pixel that's overlapped by the current triangle.
            // Fragments affect the final image or get discarded due to depth.
            return this.shared_glsl_code() + `
                varying vec2 f_tex_coord;
                uniform sampler2D texture;
                uniform float animation_time;
                
                void main(){
                    // Sample the texture image in the correct place:
                    vec4 tex_color = texture2D( texture, f_tex_coord );
                    tex_color.y = tex_color.z = tex_color.x;
                    if( tex_color.w < .01 ) discard;
                                                                             // Compute an initial (ambient) color:
                    gl_FragColor = vec4( ( tex_color.xyz + shape_color.xyz ) * ambient, shape_color.w * tex_color.w ); 
                                                                             // Compute the final color with contributions from lights:
                    gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
                  } `;
        }

        update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
            // update_GPU(): Add a little more to the base class's version of this method.
            super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
            // Updated for assignment 4
            context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
            context.uniform1i(gpu_addresses.texture, 2); // 2 for light-view depth texture
            context.activeTexture(context["TEXTURE" + 2]);
            context.bindTexture(context.TEXTURE_2D, material.texture);
        }
    }

const Buffered_Texture  =
    class Buffered_Texture extends tiny.Graphics_Card_Object {
        // **Texture** wraps a pointer to a new texture image where
        // it is stored in GPU memory, along with a new HTML image object.
        // This class initially copies the image to the GPU buffers,
        // optionally generating mip maps of it and storing them there too.
        constructor(texture_buffer_pointer) {
            super();
            Object.assign(this, {texture_buffer_pointer});
            this.ready = true;
            this.texture_buffer_pointer = texture_buffer_pointer;
        }

        copy_onto_graphics_card(context, need_initial_settings = true) {
            // copy_onto_graphics_card():  Called automatically as needed to load the
            // texture image onto one of your GPU contexts for its first time.

            // Define what this object should store in each new WebGL Context:
            const initial_gpu_representation = {texture_buffer_pointer: undefined};
            // Our object might need to register to multiple GPU contexts in the case of
            // multiple drawing areas.  If this is a new GPU context for this object,
            // copy the object to the GPU.  Otherwise, this object already has been
            // copied over, so get a pointer to the existing instance.
            const gpu_instance = super.copy_onto_graphics_card(context, initial_gpu_representation);

            if (!gpu_instance.texture_buffer_pointer) gpu_instance.texture_buffer_pointer = this.texture_buffer_pointer;

            // const gl = context;
            // gl.bindTexture(gl.TEXTURE_2D, gpu_instance.texture_buffer_pointer);
            //
            // if (need_initial_settings) {
            //     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            //     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            //     // Always use bi-linear sampling when zoomed out.
            //     gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[this.min_filter]);
            //     // Let the user to set the sampling method
            //     // when zoomed in.
            // }
            //
            // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
            // if (this.min_filter == "LINEAR_MIPMAP_LINEAR")
            //     gl.generateMipmap(gl.TEXTURE_2D);
            // // If the user picked tri-linear sampling (the default) then generate
            // // the necessary "mips" of the texture and store them on the GPU with it.
            return gpu_instance;
        }

        activate(context, texture_unit = 0) {
            // activate(): Selects this Texture in GPU memory so the next shape draws using it.
            // Optionally select a texture unit in case you're using a shader with many samplers.
            // Terminate draw requests until the image file is actually loaded over the network:
            if (!this.ready)
                return;
            const gpu_instance = super.activate(context);
            context.activeTexture(context["TEXTURE" + texture_unit]);
            context.bindTexture(context.TEXTURE_2D, this.texture_buffer_pointer);
        }
    }