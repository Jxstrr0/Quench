"""
Quench room and tool models, written as code and built by headless Blender.

Nobody opens the Blender app. Run it with the `bpy` Python package:

    pip install bpy==5.3.0
    python art/models/build.py            # every model
    python art/models/build.py anvil      # one model

Each model is a function that builds one mesh and returns it. The script
exports each as public/assets/models/<name>.glb. scripts/models-check.mjs then
holds every file to its triangle and size budget (art/models/budgets.json).

Space: Blender's own, Z up, in metres. X runs along the game's rail, away
from the forge. The exporter turns it to the game's Y-up space. Every model's
origin is where the game places it (for the anvil: the forge-side end of the
middle line of its face).

The blade is never a model. The game builds it from the sim.
"""
import json
import math
import os
import sys

import bpy  # first: it puts Blender's own modules, bmesh among them, on the path
import bmesh  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "public", "assets", "models")
MM = 0.001

with open(os.path.join(HERE, "dims.json"), encoding="utf-8") as f:
    DIMS = json.load(f)


# --- Materials: flat colours from the game's chalk-and-slate palette ---------

def material(name, colour, rough, metal):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    if not mat.node_tree:
        mat.use_nodes = True
    shader = mat.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*colour, 1.0)
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    return mat


def steel():
    return material("steel", (0.055, 0.062, 0.072), 0.6, 0.55)


def worn_steel():
    """The anvil's face: brighter where the work polishes it."""
    return material("wornSteel", (0.13, 0.14, 0.155), 0.38, 0.85)


def dark():
    return material("dark", (0.004, 0.004, 0.005), 0.9, 0.0)


# --- Mesh helpers --------------------------------------------------------------

def frustum(bm, x0, x1, y0, y1, z0, a0, b0, c0, d0, z1, mat=0):
    """A block whose bottom is the rectangle (x0..x1, y0..y1) at z0 and whose top is (a0..b0, c0..d0) at z1."""
    lo = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0))]
    hi = [bm.verts.new(p) for p in ((a0, c0, z1), (b0, c0, z1), (b0, d0, z1), (a0, d0, z1))]
    faces = [bm.faces.new(lo[::-1]), bm.faces.new(hi)]
    for i in range(4):
        j = (i + 1) % 4
        faces.append(bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
    for face in faces:
        face.material_index = mat
    return faces


def box(bm, x0, x1, y0, y1, z0, z1, mat=0):
    return frustum(bm, x0, x1, y0, y1, z0, x0, x1, y0, y1, z1, mat)


def loft(bm, rings, mat=0, cap_start=True, cap_end=True):
    """Skin a row of rings (lists of points, all the same length) into a tube."""
    made = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(made[0])
    for a, b in zip(made, made[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i])).material_index = mat
    if cap_start:
        bm.faces.new(made[0][::-1]).material_index = mat
    if cap_end:
        bm.faces.new(made[-1]).material_index = mat


def finish(name, bm, mats, bevel=0.0):
    """Turn the bmesh into an object, with sharp-edged shading and, if asked, a small bevel on every edge."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for mat in mats:
        mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(40)
    return obj


# --- Models --------------------------------------------------------------------

def anvil():
    """
    A London-pattern anvil, squat, to sit on the floor of the scene. Its face
    is the plane z = 0 from x = 0 to its full length; nothing stands above it.
    The horn points away from the forge.
    """
    length = DIMS["anvilLength"] * MM
    half = DIMS["anvilWidth"] * MM / 2
    floor = -DIMS["floorDrop"] * MM
    body = length * 0.7          # the flat face; the horn takes the rest
    top = -0.034                 # underside of the face block
    bm = bmesh.new()

    # Feet: a wide base that steps in.
    box(bm, 0.012, body - 0.008, -half, half, floor, floor + 0.014)
    frustum(bm, 0.012, body - 0.008, -half, half, floor + 0.014,
            0.045, body - 0.045, -half * 0.62, half * 0.62, floor + 0.04)
    # Waist.
    frustum(bm, 0.045, body - 0.045, -half * 0.62, half * 0.62, floor + 0.04,
            0.03, body - 0.02, -half * 0.8, half * 0.8, top)
    # The face block, heel overhanging the waist on the forge side.
    box(bm, 0.0, body, -half, half, top, -0.003)
    # The hard face: a plate on top, worn bright.
    box(bm, 0.0, body, -half, half, -0.003, 0.0, mat=1)
    # The step, then the horn: rings that shrink and droop to a blunt point.
    step = body + 0.012
    box(bm, body, step, -half * 0.86, half * 0.86, top + 0.004, -0.006)
    rings = []
    for k in range(6):
        t = k / 5
        x = step + (length - step) * t
        r = half * 0.86 * (1 - t) ** 0.8 + 0.004
        zc = -0.006 - r * 0.62      # the top line of the horn stays just under the face
        ring = [(x, r * math.cos(a), zc + r * 0.62 * math.sin(a))
                for a in (math.radians(22.5 + 45 * i) for i in range(8))]
        rings.append(ring)
    loft(bm, rings)
    # The hardy hole and the pritchel hole, near the heel: dark insets in the face.
    box(bm, 0.016, 0.034, -0.009, 0.009, -0.002, 0.0004, mat=2)
    box(bm, 0.044, 0.052, 0.018, 0.026, -0.002, 0.0004, mat=2)
    return finish("anvil", bm, [steel(), worn_steel(), dark()], bevel=0.0025)


MODELS = {"anvil": anvil}


def export(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj = MODELS[name]()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
        export_animations=False,
    )
    print(f"built {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    wanted = [a for a in sys.argv[1:] if not a.startswith("-")] or list(MODELS)
    for each in wanted:
        if each not in MODELS:
            sys.exit(f"no model called {each}: there is {', '.join(MODELS)}")
        export(each)
