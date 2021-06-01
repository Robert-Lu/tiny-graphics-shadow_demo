import {defs, tiny} from './common.js';
import {Shape_From_File} from "./obj-file-demo.js";

const {
    Vector, Vector3, Vector4, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture,
} = tiny;

const {Cube, Axis_Arrows, Textured_Phong, Basic_Shader, Closed_Cone, Cylindrical_Tube} = defs

const Axes = defs.Axes =
    class Axes extends Shape {
        // An axis set with arrows, made out of a lot of various primitives.
        constructor() {
            super("position", "normal", "texture_coord");
            let stack = [];
            // Subdivision_Sphere.insert_transformed_copy_into(this, [3], Mat4.rotation(Math.PI / 2, 0, 1, 0).times(Mat4.scale(.25, .25, .25)));
            this.drawOneAxis(Mat4.identity(), [[.7, 1], [.3, .7]]);
            this.drawOneAxis(Mat4.rotation(-Math.PI / 2, 1, 0, 0).times(Mat4.scale(1, -1, 1)), [[.4, .6], [.3, .7]]);
            this.drawOneAxis(Mat4.rotation(Math.PI / 2, 0, 1, 0).times(Mat4.scale(-1, 1, 1)), [[0, .3], [.3, .7]]);
        }

        drawOneAxis(transform, tex) {
            // Use a different texture coordinate range for each of the three axes, so they show up differently.
            Closed_Cone.insert_transformed_copy_into(this, [8, 16, tex], transform.times(Mat4.translation(0, 0, 5)).times(Mat4.scale(.2, .2, .2)));
            // Cube.insert_transformed_copy_into(this, [], transform.times(Mat4.translation(.95, .95, .45)).times(Mat4.scale(.05, .05, .45)));
            // Cube.insert_transformed_copy_into(this, [], transform.times(Mat4.translation(.95, 0, .5)).times(Mat4.scale(.05, .05, .4)));
            // Cube.insert_transformed_copy_into(this, [], transform.times(Mat4.translation(0, .95, .5)).times(Mat4.scale(.05, .05, .4)));
            Cylindrical_Tube.insert_transformed_copy_into(this, [12, 12, tex], transform.times(Mat4.translation(0, 0, 2.5)).times(Mat4.scale(.1, .1, 5)));
        }
    }

class Triangle extends Shape {
    constructor() {
        super("position", "color");
        this.arrays.position = Vector3.cast(
            [3, 0, 0], [0, 3, 0], [0, 0, 3]
        );
        this.arrays.color.push(
            color(1, 0, 0, 1),
            color(1, 1, 0, 1),
            color(1, 1, 1, 1),
        )
        this.indices = false;
    }
}

export class Mouse_Demo extends Scene {
    /**
     *  **Base_scene** is a Scene that can be added to any display canvas.
     *  Setup the shapes, materials, camera, and lighting here.
     */
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        this.shapes = {
            teapot: new Shape_From_File("./assets/teapot.obj"),
            triangle: new Triangle(),
            axis: new Axes()
        }

        const bump = new defs.Fake_Bump_Map();
        this.materials = {
            phong: new Material(new Textured_Phong(), {
                color: hex_color("#ffffff"),
            }),
            texture: new Material(new Textured_Phong(), {
                color: hex_color("#ffffff"),
                ambient: .5, diffusivity: 0.1, specularity: 0.1,
                texture: new Texture("assets/stars.png")
            }),
            axes_mat: new Material(bump, {
                color: color(0, 0, 0, 1), ambient: 1,
                texture: new Texture("assets/rgb.jpg")
            }),
            basic: new Material(new Basic_Shader()),
            mybasic: new Material(new My_Basic_Shader()),
        }

        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));

        this.animation_queue = [];
    }

    make_control_panel() {
        // TODO:  Implement requirement #5 using a key_triggered_button that responds to the 'c' key.
    }

    my_mouse_down(e, pos, context, program_state) {
        let pos_ndc_near = vec4(pos[0], pos[1], -1.0, 1.0);
        let pos_ndc_far  = vec4(pos[0], pos[1],  1.0, 1.0);
        let center_ndc_near = vec4(0.0, 0.0, -1.0, 1.0);
        let P = program_state.projection_transform;
        let V = program_state.camera_inverse;
        let pos_world_near = Mat4.inverse(P.times(V)).times(pos_ndc_near);
        let pos_world_far  = Mat4.inverse(P.times(V)).times(pos_ndc_far);
        let center_world_near  = Mat4.inverse(P.times(V)).times(center_ndc_near);
        pos_world_near.scale_by(1 / pos_world_near[3]);
        pos_world_far.scale_by(1 / pos_world_far[3]);
        center_world_near.scale_by(1 / center_world_near[3]);
        // console.log(pos_world_near);
        // console.log(pos_world_far);
        //
        // Do whatever you want
        let animation_bullet = {
            from: center_world_near,
            to: pos_world_far,
            start_time: program_state.animation_time,
            end_time: program_state.animation_time + 5000,
            more_info: "add gravity"
        }

        this.animation_queue.push(animation_bullet)
    }

    display(context, program_state) {
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            let LookAt = Mat4.look_at(vec3(0, 0, 10), vec3(0, 0, 0), vec3(0, 1, 0));
            program_state.set_camera(LookAt);

            let canvas = context.canvas;
            const mouse_position = (e, rect = canvas.getBoundingClientRect()) =>
                vec((e.clientX - (rect.left + rect.right) / 2) / ((rect.right - rect.left) / 2),
                    (e.clientY - (rect.bottom + rect.top) / 2) / ((rect.top - rect.bottom) / 2));

            canvas.addEventListener("mousedown", e => {
                e.preventDefault();
                const rect = canvas.getBoundingClientRect()
                console.log("e.clientX: " + e.clientX);
                console.log("e.clientX - rect.left: " + (e.clientX - rect.left));
                console.log("e.clientY: " + e.clientY);
                console.log("e.clientY - rect.top: " + (e.clientY - rect.top));
                console.log("mouse_position(e): " + mouse_position(e));
                this.my_mouse_down(e, mouse_position(e), context, program_state);
            });
        }

        // let m = Mat4.orthographic(-1.0, 1.0, -1.0, 1.0, 0, 100);
        //
        // let plane_size = 10;
        // let ratio  = context.width / context.height;
        // let right  = plane_size;
        // let left   = -plane_size;
        // let top    = plane_size / ratio;
        // let bottom = -plane_size / ratio;
        // let near   = 1;
        // let far    = 100;
        //
        // let A = Mat4.scale(1 / (right - left), 1 / (top - bottom), 1 / (far - near));
        // let B = Mat4.translation(-left - right, -top - bottom, -near - far);
        // let C = Mat4.scale(2, 2, -2);
        // let orthographic_proj = A.times(B).times(C);

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);
        // program_state.projection_transform = orthographic_proj;

        const light_position = vec4(10, 10, 10, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // let transpose = Mat4.of([1,0,0,0], [0,0,1,0], [0,1,0,0], [0,0,0,1], )
        this.shapes.axis.draw(context, program_state, Mat4.identity(), this.materials.axes_mat);
        // this.shapes.triangle.draw(context, program_state, Mat4.identity(), this.materials.basic);
        // this.shapes.triangle.draw(context, program_state, Mat4.translation(5, 0, 5), this.materials.basic);
        // this.shapes.triangle.draw(context, program_state, Mat4.translation(-5, 0, -5), this.materials.basic);
        // this.shapes.triangle.draw(context, program_state, Mat4.translation(0, 3, 0), this.materials.mybasic);

        let t = program_state.animation_time;
        if (this.animation_queue.length > 0) {
            for (let i = 0; i < this.animation_queue.length; i++) {
                let animation_bullet = this.animation_queue[i];

                let from = animation_bullet.from;
                let to = animation_bullet.to;
                let start_time = animation_bullet.start_time;
                let end_time = animation_bullet.end_time;

                if (t <= end_time && t >= start_time) {
                    let animation_process = (t - start_time) / (end_time - start_time);
                    let position = to.times(animation_process).plus(from.times(1 - animation_process));

                    if (animation_bullet.more_info === "add gravity") {
                        position[1] -= 0.5 * 9.8 * ((t - start_time) / 1000) ** 2;
                    }

                    let model_trans = Mat4.translation(position[0], position[1], position[2])
                        .times(Mat4.rotation(animation_process * 50, .3, .6, .2))
                    this.shapes.teapot.draw(context, program_state, model_trans, this.materials.texture);
                }
            }
        }
        // remove finished animation
        while (this.animation_queue.length > 0) {
            if (t > this.animation_queue[0].end_time) {
                this.animation_queue.shift();
            }
            else {
                break;
            }
        }
    }
}

class My_Basic_Shader extends Basic_Shader {
    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `precision mediump float;
                varying vec4 VERTEX_COLOR;
                varying vec3 VERTEX_POSITION;
                uniform float animation_time;
            `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
                attribute vec4 color;
                attribute vec3 position;
                // Position is expressed in object coordinates.
                uniform mat4 projection_camera_model_transform;

                void main(){
                    // Compute the vertex's final resting place (in NDCS), and use the hard-coded color of the vertex:
                    gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                    VERTEX_COLOR = color;
                    VERTEX_POSITION = position;
                }`;
    }

    fragment_glsl_code() {
        return this.shared_glsl_code() + `
            void main(){
                // The interpolation gets done directly on the per-vertex colors:
                float alpha = sin(animation_time) / 2.0 + 0.5;
                if (mod(VERTEX_POSITION.x + animation_time, 0.5) > 0.25) {
                    gl_FragColor = vec4(VERTEX_POSITION / 3.0, alpha);
                } else {
                    gl_FragColor = vec4(VERTEX_COLOR.xyz, 1.0 - alpha);
                }
            }`;
    }
    // gl_FragColor = vec4(VERTEX_COLOR.zyx, 1.0);
    // float alpha = sin(animation_time) / 2.0 + 0.5;
    // if (mod(VERTEX_POSITION.x + animation_time, 0.5) > 0.25) {
    //     gl_FragColor = vec4(VERTEX_POSITION / 3.0, alpha);
    // } else {
    //     gl_FragColor = vec4(VERTEX_COLOR.xyz, 1.0 - alpha);
    // }

    //
    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Add a little more to the base class's version of this method.
        super.update_GPU(context, gpu_addresses, gpu_state, model_transform, material);
        context.uniform1f(gpu_addresses.animation_time, gpu_state.animation_time / 1000);
    }
}