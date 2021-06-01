import {defs, tiny} from './common.js';
import {Body, Test_Data} from "./collisions-demo.js";

// Pull these names into this module's scope for convenience:
const {vec3, unsafe3, vec4, color, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;

export class Simulation extends Scene {
    // **Simulation** manages the stepping of simulation time.  Subclass it when making
    // a Scene that is a physics demo.  This technique is careful to totally decouple
    // the simulation from the frame rate (see below).
    constructor() {
        super();
        Object.assign(this, {time_accumulator: 0, time_scale: 1/1000.0, t: 0, dt: 1 / 50, bodies: [], steps_taken: 0});
    }

    simulate(frame_time) {
        // simulate(): Carefully advance time according to Glenn Fiedler's
        // "Fix Your Timestep" blog post.
        // This line gives ourselves a way to trick the simulator into thinking
        // that the display framerate is running fast or slow:
        frame_time = this.time_scale * frame_time;

        // Avoid the spiral of death; limit the amount of time we will spend
        // computing during this timestep if display lags:
        this.time_accumulator += Math.min(frame_time, 0.1);
        // Repeatedly step the simulation until we're caught up with this frame:
        while (Math.abs(this.time_accumulator) >= this.dt) {
            // Single step of the simulation for all bodies:
            this.update_state(this.dt);
            for (let b of this.bodies)
                b.advance(this.dt);
            // Following the advice of the article, de-couple
            // our simulation time from our frame rate:
            this.t += Math.sign(frame_time) * this.dt;
            this.time_accumulator -= Math.sign(frame_time) * this.dt;
            this.steps_taken++;
        }
        // Store an interpolation factor for how close our frame fell in between
        // the two latest simulation time steps, so we can correctly blend the
        // two latest states and display the result.
        let alpha = this.time_accumulator / this.dt;
        for (let b of this.bodies) b.blend_state(alpha);
    }

    make_control_panel() {
        // make_control_panel(): Create the buttons for interacting with simulation time.
        this.key_triggered_button("Speed up time", ["Shift", "T"], () => this.time_scale *= 5);
        this.key_triggered_button("Slow down time", ["t"], () => this.time_scale /= 5);
        this.new_line();
        this.live_string(box => {
            box.textContent = "Time scale: " + this.time_scale
        });
        this.new_line();
        this.live_string(box => {
            box.textContent = "Fixed simulation time step size: " + this.dt
        });
        this.new_line();
        this.live_string(box => {
            box.textContent = this.steps_taken + " timesteps were taken so far."
        });
    }

    display(context, program_state) {
        // display(): advance the time and state of our whole simulation.
        if (program_state.animate)
            this.simulate(program_state.animation_delta_time);
        // Draw each shape at its current location:
        for (let b of this.bodies)
            b.shape.draw(context, program_state, b.drawn_location, b.material);
    }

    update_state(dt)      // update_state(): Your subclass of Simulation has to override this abstract function.
    {
        throw "Override this"
    }
}

export class Control_Demo extends Simulation {
    // ** Inertia_Demo** demonstration: This scene lets random initial momentums
    // carry several bodies until they fall due to gravity and bounce.
    constructor() {
        super();
        this.data = new Test_Data();
        this.shapes = Object.assign({}, this.data.shapes);
        this.shapes.square = new defs.Square();
        const shader = new defs.Fake_Bump_Map(1);
        this.material = new Material(shader, {
            color: color(0, 0, 0, 1),
            ambient: .5, texture: this.data.textures.stars
        })
        // The agent
        this.agent = new defs.Subdivision_Sphere(4);
        this.agent_pos = vec3(0, -4, 0);
        this.agent_size = 5.0;

        this.control = {};
        this.control.w = false;
        this.control.a = false;
        this.control.s = false;
        this.control.d = false;
        this.control.space = false;
    }

    random_color() {
        return this.material.override(color(.6, .6 * Math.random(), .6 * Math.random(), 1));
    }

    make_control_panel() {
        super.make_control_panel();
        this.new_line();
        this.key_triggered_button("Foward", ["Shift", "W"],
            () => this.control.w = true, '#6E6460', () => this.control.w = false);
        this.key_triggered_button("Back",   ["Shift", "S"],
            () => this.control.s = true, '#6E6460', () => this.control.s = false);
        this.key_triggered_button("Left",   ["Shift", "A"],
            () => this.control.a = true, '#6E6460', () => this.control.a = false);
        this.key_triggered_button("Right",  ["Shift", "D"],
            () => this.control.d = true, '#6E6460', () => this.control.d = false);
        this.key_triggered_button("Speed Up",  ["Shift", " "],
            () => this.control.space = true, '#6E6460', () => this.control.space = false);
    }

    update_state(dt) {
        // update_state():  Override the base time-stepping code to say what this particular
        // scene should do to its bodies every frame -- including applying forces.
        // Generate additional moving bodies if there ever aren't enough:
        while (this.bodies.length < 100)
            this.bodies.push(new Body(this.data.random_shape(), this.random_color(), vec3(1, 1 + Math.random(), 1))
                .emplace(Mat4.translation(...vec3(0, 15, 0).randomized(10)),
                    vec3(0, -1, 0).randomized(2).normalized().times(3), Math.random()));

        for (let b of this.bodies) {
            // Gravity on Earth, where 1 unit in world space = 1 meter:
            b.linear_velocity[1] += dt * -9.8;
            // If about to fall through floor, reverse y velocity:
            if (b.center[1] < -8 && b.linear_velocity[1] < 0)
                b.linear_velocity[1] *= -.8;
            // Simple Sphere Collision Implementation
            let dis = b.center.minus(this.agent_pos);
            if (dis.norm() < this.agent_size) {
                b.linear_velocity.add_by(dis.times(dt * 98));
            }
        }

        // Control
        let speed = 10.0;
        if (this.control.space)
            speed *= 3;
        if (this.control.w) {
            this.agent_pos[2] -= dt * speed;
        }
        if (this.control.s) {
            this.agent_pos[2] += dt * speed;
        }
        if (this.control.a) {
            this.agent_pos[0] -= dt * speed;
        }
        if (this.control.d) {
            this.agent_pos[0] += dt * speed;
        }

        // Delete bodies that stop or stray too far away:
        this.bodies = this.bodies.filter(b => b.center.norm() < 50 && (b.linear_velocity.norm() > 2 || b.center[1] > -8));
    }

    display(context, program_state) {
        // display(): Draw everything else in the scene besides the moving bodies.
        super.display(context, program_state);

        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            this.children.push(new defs.Program_State_Viewer());
            program_state.set_camera(Mat4.translation(0, 0, -50));    // Locate the camera here (inverted matrix).
        }
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        program_state.lights = [new Light(vec4(0, -5, -10, 1), color(1, 1, 1, 1), 100000)];
        // Draw the ground:
        this.shapes.square.draw(context, program_state, Mat4.translation(0, -10, 0)
                .times(Mat4.rotation(Math.PI / 2, 1, 0, 0)).times(Mat4.scale(50, 50, 1)),
            this.material.override({ambient:.8, texture: this.data.textures.grid}));

        let agent_trans = Mat4.translation(this.agent_pos[0], this.agent_pos[1], this.agent_pos[2]).
            times(Mat4.scale(this.agent_size,this.agent_size,this.agent_size));

        this.agent.draw(context, program_state, agent_trans, this.material.
            override({ambient: 1.0, texture: this.data.textures.earth}));
    }

    // show_explanation(document_element) {
    //     document_element.innerHTML += `<p>This demo lets random initial momentums carry bodies until they fall and bounce.  It shows a good way to do incremental movements, which are crucial for making objects look like they're moving on their own instead of following a pre-determined path.  Animated objects look more real when they have inertia and obey physical laws, instead of being driven by simple sinusoids or periodic functions.
    //                                  </p><p>For each moving object, we need to store a model matrix somewhere that is permanent (such as inside of our class) so we can keep consulting it every frame.  As an example, for a bowling simulation, the ball and each pin would go into an array (including 11 total matrices).  We give the model transform matrix a \"velocity\" and track it over time, which is split up into linear and angular components.  Here the angular velocity is expressed as an Euler angle-axis pair so that we can scale the angular speed how we want it.
    //                                  </p><p>The forward Euler method is used to advance the linear and angular velocities of each shape one time-step.  The velocities are not subject to any forces here, but just a downward acceleration.  Velocities are also constrained to not take any objects under the ground plane.
    //                                  </p><p>This scene extends class Simulation, which carefully manages stepping simulation time for any scenes that subclass it.  It totally decouples the whole simulation from the frame rate, following the suggestions in the blog post <a href=\"https://gafferongames.com/post/fix_your_timestep/\" target=\"blank\">\"Fix Your Timestep\"</a> by Glenn Fielder.  Buttons allow you to speed up and slow down time to show that the simulation's answers do not change.</p>`;
    // }
}