// THE STATE
// The application state will be an object with picture, tool, and color properties. The picture is itself an object that stores the width, height, and pixel content of the picture. The pixels are stored in an array, in the same way as the matrix class from Chapter 6—row by row, from top to bottom.
class Picture {
    constructor(width, height, pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
    }
    static empty(width, height, color) {
        let pixels = new Array(width * height).fill(color);
        return new Picture(width, height, pixels);
    }
    pixel(x, y) {
        return this.pixels[x + y * this.width];
    }
    draw(pixels) {
        let copy = this.pixels.slice();
        for (let { x, y, color } of pixels) {
            copy[x + y * this.width] = color;
        }
        return new Picture(this.width, this.height, copy);
    }
}
// We want to be able to treat a picture as an immutable value, for reasons that we’ll get back to later in the chapter. But we also sometimes need to update a whole bunch of pixels at a time. To be able to do that, the class has a draw method that expects an array of updated pixels—objects with x, y, and color properties—and creates a new picture with those pixels overwritten. This method uses slice without arguments to copy the entire pixel array

// We’ll allow the interface to dispatch actions as objects whose properties overwrite the properties of the previous state. The color field, when the user changes it, could dispatch an object like {color: field.value}, from which this update function can compute a new state.
function updateState(state, action) {
    return Object.assign({}, state, action);
}

// DOM BUILDING
// One of the main things that interface components do is creating DOM structure. We again don’t want to directly use the verbose DOM methods for that, so here’s a slightly expanded version of the elt function:
function elt(type, props, ...children) {
    let dom = document.createElement(type);
    if (props) Object.assign(dom, props);
    for (let child of children) {
        if (typeof child != "string") dom.appendChild(child);
        else dom.appendChild(document.createTextNode(child));
    }
    return dom;
}

// THE CANVAS
// The first component we’ll define is the part of the interface that displays the picture as a grid of colored boxes. This component is responsible for two things: showing a picture and communicating pointer events on that picture to the rest of the application.
// As such, we can define it as a component that knows about only the current picture, not the whole application state. Because it doesn’t know how the application as a whole works, it cannot directly dispatch actions. Rather, when responding to pointer events, it calls a callback function provided by the code that created it, which will handle the application-specific parts.
const scale = 10;

class PictureCanvas {
    constructor(picture, pointerDown) {
        this.dom = elt("canvas", {
            onmousedown: (event) => this.mouse(event, pointerDown),
            ontouchstart: (event) => this.touch(event, pointerDown),
        });
        this.syncState(picture);
    }
    syncState(picture) {
        if (this.picture == picture) return;
        this.picture = picture;
        drawPicture(this.picture, this.dom, scale);
    }
}
// We draw each pixel as a 10-by-10 square, as determined by the scale constant. To avoid unnecessary work, the component keeps track of its current picture and does a redraw only when syncState is given a new picture.
// The actual drawing function sets the size of the canvas based on the scale and picture size and fills it with a series of squares, one for each pixel.
function drawPicture(picture, canvas, scale) {
    canvas.width = picture.width * scale;
    canvas.height = picture.height * scale;
    let cx = canvas.getContext("2d");

    for (let y = 0; y < picture.height; y++) {
        for (let x = 0; x < picture.width; x++) {
            cx.fillStyle = picture.pixel(x, y);
            cx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
}
// When the left mouse button is pressed while the mouse is over the picture canvas, the component calls the pointerDown callback, giving it the position of the pixel that was clicked — in picture coordinates
// This will be used to implement mouse interaction with the picture. The callback may return another callback function to be notified when the pointer is moved to a different pixel while the button is held down.
PictureCanvas.prototype.mouse = function (downEvent, onDown) {
    if (downEvent.button != 0) return;
    let pos = pointerPosition(downEvent, this.dom);
    let onMove = onDown(pos);
    if (!onMove) return;
    let move = (moveEvent) => {
        if (moveEvent.buttons == 0) {
            this.dom.removeEventListener("mousemove", move);
        } else {
            let newPos = pointerPosition(moveEvent, this.dom);
            if (newPos.x == pos.x && newPos.y == pos.y) return;
            pos = newPos;
            onMove(newPos);
        }
    };
    this.dom.addEventListener("mousemove", move);
};

function pointerPosition(pos, domNode) {
    let rect = domNode.getBoundingClientRect();
    return {
        x: Math.floor((pos.clientX - rect.left) / scale),
        y: Math.floor((pos.clientY - rect.top) / scale),
    };
}
// Since we know the size of the pixels and we can use getBoundingClientRect to find the position of the canvas on the screen, it is possible to go from mouse event coordinates (clientX and clientY) to picture coordinates. These are always rounded down so that they refer to a specific pixel.
// With touch events, we have to do something similar, but using different events and making sure we call preventDefault on the "touchstart" event to prevent panning.
PictureCanvas.prototype.touch = function (startEvent, onDown) {
    let pos = pointerPosition(startEvent.touches[0], this.dom);
    let onMove = onDown(pos);
    startEvent.preventDefault();
    if (!onMove) return;
    let move = (moveEvent) => {
        let newPos = pointerPosition(moveEvent.touches[0], this.dom);
        if (newPos.x == pos.x && newPos.y == pos.y) return;
        pos = newPos;
        onMove(newPos);
    };
    let end = () => {
        this.dom.removeEventListener("touchmove", move);
        this.dom.removeEventListener("touchend", end);
    };
    this.dom.addEventListener("touchmove", move);
    this.dom.addEventListener("touchend", end);
};
// For touch events, clientX and clientY aren’t available directly on the event object, but we can use the coordinates of the first touch object in the touches property.

// THE APPLICATION
// To make it possible to build the application piece by piece, we’ll implement the main component as a shell around a picture canvas and a dynamic set of tools and controls that we pass to its constructor.
// The controls are the interface elements that appear below the picture. They’ll be provided as an array of component constructors.
// The tools do things like drawing pixels or filling in an area. The application shows the set of available tools as a <select> field. The currently selected tool determines what happens when the user interacts with the picture with a pointer device. The set of available tools is provided as an object that maps the names that appear in the drop-down field to functions that implement the tools. Such functions get a picture position, a current application state, and a dispatch function as arguments. They may return a move handler function that gets called with a new position and a current state when the pointer moves to a different pixel.

// EXERCISE:
// Add keyboard shortcuts to the application. The first letter of a tool’s name selects the tool, and control-Z or command-Z activates undo.

// Do this by modifying the PixelEditor component. Add a tabIndex property of 0 to the wrapping <div> element so that it can receive keyboard focus. Note that the property corresponding to the tabindex attribute is called tabIndex, with a capital I, and our elt function expects property names. Register the key event handlers directly on that element. This means you have to click, touch, or tab to the application before you can interact with it with the keyboard.

// Remember that keyboard events have ctrlKey and metaKey (for the command key on Mac) properties that you can use to see whether those keys are held down.

class PixelEditor {
    constructor(state, config) {
        let { tools, controls, dispatch } = config;
        this.state = state;

        this.canvas = new PictureCanvas(state.picture, (pos) => {
            let tool = tools[this.state.tool];
            let onMove = tool(pos, this.state, dispatch);
            if (onMove) return (pos) => onMove(pos, this.state);
        });
        this.controls = controls.map((Control) => new Control(state, config));
        this.dom = elt(
            "div",
            {
                tabIndex: 0,
                onkeydown: (event) => {
                    this.keyboardShortcuts(event, dispatch);
                },
            },
            this.canvas.dom,
            elt("br"),
            ...this.controls.reduce((a, c) => a.concat(" ", c.dom), []),
        );
    }
    keyboardShortcuts(event, dispatch) {
        const { ctrlKey, metaKey, key } = event;
        if (key == "z" && (ctrlKey || metaKey)) {
            dispatch({ undo: true });
        }
        const SHORTCUTS = {
            d: "draw",
            f: "fill",
            r: "rectangle",
            p: "pick",
        };
        const tool = SHORTCUTS[key];
        if (!tool) {
            return;
        }
        dispatch({ tool });
    }
    syncState(state) {
        this.state = state;
        this.canvas.syncState(state.picture);
        for (let ctrl of this.controls) ctrl.syncState(state);
    }
}
// The pointer handler given to PictureCanvas calls the currently selected tool with the appropriate arguments and, if that returns a move handler, adapts it to also receive the state.
// All controls are constructed and stored in this.controls so that they can be updated when the application state changes. The call to reduce introduces spaces between the controls’ DOM elements. That way they don’t look so pressed together.

// The first control is the tool selection menu. It creates a <select> element with an option for each tool and sets up a "change" event handler that updates the application state when the user selects a different tool.
class ToolSelect {
    constructor(state, { tools, dispatch }) {
        this.select = elt(
            "select",
            {
                onchange: () => dispatch({ tool: this.select.value }),
            },
            ...Object.keys(tools).map((name) =>
                elt(
                    "option",
                    {
                        selected: name == state.tool,
                    },
                    name,
                ),
            ),
        );
        this.dom = elt("label", null, "🖌 Tool: ", this.select);
    }
    syncState(state) {
        this.select.value = state.tool;
    }
}
// By wrapping the label text and the field in a <label> element, we tell the browser that the label belongs to that field so that you can, for example, click the label to focus the field.

// We also need to be able to change the color, so let’s add a control for that

// This control creates such a field and wires it up to stay synchronized with the application state’s color property.
class ColorSelect {
    constructor(state, { dispatch }) {
        this.input = elt("input", {
            type: "color",
            value: state.color,
            onchange: () => dispatch({ color: this.input.value }),
        });
        this.dom = elt("label", null, "🎨 Color: ", this.input);
    }
    syncState(state) {
        this.input.value = state.color;
    }
}

// DRAWING TOOLS
// Before we can draw anything, we need to implement the tools that will control the functionality of mouse or touch events on the canvas.
// The most basic tool is the draw tool, which changes any pixel you click or tap to the currently selected color. It dispatches an action that updates the picture to a version in which the pointed-at pixel is given the currently selected color.
function draw(pos, state, dispatch) {
    function drawPixel({ x, y }, state) {
        let drawn = { x, y, color: state.color };
        dispatch({ picture: state.picture.draw([drawn]) });
    }
    drawPixel(pos, state);
    return drawPixel;
}
// The function immediately calls the drawPixel function but then also returns it so that it is called again for newly touched pixels when the user drags or swipes over the picture.

// To draw larger shapes, it can be useful to quickly create rectangles. The rectangle tool draws a rectangle between the point where you start dragging and the point that you drag to.
function rectangle(start, state, dispatch) {
    function drawRectangle(pos) {
        let xStart = Math.min(start.x, pos.x);
        let yStart = Math.min(start.y, pos.y);
        let xEnd = Math.max(start.x, pos.x);
        let yEnd = Math.max(start.y, pos.y);
        let drawn = [];
        for (let y = yStart; y <= yEnd; y++) {
            for (let x = xStart; x <= xEnd; x++) {
                drawn.push({ x, y, color: state.color });
            }
        }
        dispatch({ picture: state.picture.draw(drawn) });
    }
    drawRectangle(start);
    return drawRectangle;
}
// An important detail in this implementation is that when dragging, the rectangle is redrawn on the picture from the original state. That way, you can make the rectangle larger and smaller again while creating it, without the intermediate rectangles sticking around in the final picture
// This is one of the reasons why immutable picture objects are useful — we’ll see another reason later.

// Implementing flood fill is somewhat more involved. This is a tool that fills the pixel under the pointer and all adjacent pixels that have the same color. “Adjacent” means directly horizontally or vertically adjacent, not diagonally
const around = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
];

function fill({ x, y }, state, dispatch) {
    let targetColor = state.picture.pixel(x, y);
    let drawn = [{ x, y, color: state.color }];
    for (let done = 0; done < drawn.length; done++) {
        for (let { dx, dy } of around) {
            let x = drawn[done].x + dx,
                y = drawn[done].y + dy;
            if (
                x >= 0 &&
                x < state.picture.width &&
                y >= 0 &&
                y < state.picture.height &&
                state.picture.pixel(x, y) == targetColor &&
                !drawn.some((p) => p.x == x && p.y == y)
            ) {
                drawn.push({ x, y, color: state.color });
            }
        }
    }
    dispatch({ picture: state.picture.draw(drawn) });
}
function pick(pos, state, dispatch) {
    dispatch({ color: state.picture.pixel(pos.x, pos.y) });
}

// SAVING AND LOADING
// We should add a button for downloading the current picture as an image file. This control provides that button:
class SaveButton {
    constructor(state) {
        this.picture = state.picture;
        this.dom = elt(
            "button",
            {
                onclick: () => this.save(),
            },
            "💾 Save",
        );
    }
    save() {
        let canvas = elt("canvas");
        drawPicture(this.picture, canvas, 10);
        let link = elt("a", {
            href: canvas.toDataURL(),
            download: "pixelart.png",
        });
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
    syncState(state) {
        this.picture = state.picture;
    }
}
// The toDataURL method on a canvas element creates a URL that starts with data:. Unlike http: and https: URLs, data URLs contain the whole resource in the URL. They are usually very long, but they allow us to create working links to arbitrary pictures, right here in the browser.
// To actually get the browser to download the picture, we then create a link element that points at this URL and has a download attribute. Such links, when clicked, make the browser show a file save dialog. We add that link to the document, simulate a click on it, and remove it again.

// We’ll also want to be able to load existing image files into our application. To do that, we again define a button component.

class LoadButton {
    constructor(_, { dispatch }) {
        this.dom = elt(
            "button",
            {
                onclick: () => startLoad(dispatch),
            },
            "📁 Load",
        );
    }
    syncState() {}
}

function startLoad(dispatch) {
    let input = elt("input", {
        type: "file",
        onchange: () => finishLoad(input.files[0], dispatch),
    });
    document.body.appendChild(input);
    input.click();
    input.remove();
}
// When the user has selected a file, we can use FileReader to get access to its contents, again as a data URL. That URL can be used to create an <img> element, but because we can’t get direct access to the pixels in such an image, we can’t create a Picture object from that.

function finishLoad(file, dispatch) {
    if (file == null) return;
    let reader = new FileReader();
    reader.addEventListener("load", () => {
        let image = elt("img", {
            onload: () =>
                dispatch({
                    picture: pictureFromImage(image),
                }),
            src: reader.result,
        });
    });
    reader.readAsDataURL(file);
}
// To get access to the pixels, we must first draw the picture to a <canvas> element. The canvas context has a getImageData method that allows a script to read its pixels. So, once the picture is on the canvas, we can access it and construct a Picture object.
function pictureFromImage(image) {
    let width = Math.min(100, image.width);
    let height = Math.min(100, image.height);
    let canvas = elt("canvas", { width, height });
    let cx = canvas.getContext("2d");
    cx.drawImage(image, 0, 0);
    let pixels = [];
    let { data } = cx.getImageData(0, 0, width, height);

    function hex(n) {
        return n.toString(16).padStart(2, "0");
    }
    for (let i = 0; i < data.length; i += 4) {
        let [r, g, b] = data.slice(i, i + 3);
        pixels.push("#" + hex(r) + hex(g) + hex(b));
    }
    return new Picture(width, height, pixels);
}
// We’ll limit the size of images to 100 by 100 pixels since anything bigger will look huge on our display and might slow down the interface.
// The data property of the object returned by getImageData is an array of color components
// The toString method of numbers can be given a base as argument, so n.toString(16) will produce a string representation in base 16. We have to make sure that each number takes up two digits, so the hex helper function calls padStart to add a leading zero when necessary.

// UNDO HISTORY
// To be able to undo changes, we need to store previous versions of the picture. Since it’s an immutable value, that is easy. But it does require an additional field in the application state.

// We’ll add a done array to keep previous versions of the picture. Maintaining this property requires a more complicated state update function that adds pictures to the array

// But we don’t want to store every change, only changes a certain amount of time apart. To be able to do that, we’ll need a second property, doneAt, tracking the time at which we last stored a picture in the history.
// When the action is an undo action, the function takes the most recent picture from the history and makes that the current picture. It sets doneAt to zero so that the next change is guaranteed to store the picture back in the history, allowing you to revert to it another time if you want.

// Otherwise, if the action contains a new picture and the last time we stored something is more than a second (1000 milliseconds) ago, the done and doneAt properties are updated to store the previous picture.
function historyUpdateState(state, action) {
    if (action.undo == true) {
        if (state.done.length == 0) return state;
        return Object.assign({}, state, {
            picture: state.done[0],
            done: state.done.slice(1),
            doneAt: 0,
        });
    } else if (action.picture && state.doneAt < Date.now() - 1000) {
        return Object.assign({}, state, action, {
            done: [state.picture, ...state.done],
            doneAt: Date.now(),
        });
    } else {
        return Object.assign({}, state, action);
    }
}
// The undo button component doesn’t do much. It dispatches undo actions when clicked and disables itself when there is nothing to undo.

class UndoButton {
    constructor(state, { dispatch }) {
        this.dom = elt(
            "button",
            {
                onclick: () => dispatch({ undo: true }),
                disabled: state.done.length == 0,
            },
            "⮪ Undo",
        );
    }
    syncState(state) {
        this.dom.disabled = state.done.length == 0;
    }
}
