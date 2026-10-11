"""Author The Season's original playable-sample assets in Blender 4.5.

Run from any directory:
  blender --background --python /path/to/aenon/scripts/art/build_sample.py

No downloaded models, textures, rigs, motions, or add-ons are used. Geometry and
small painted surface images are authored below. The .blend files are the editable
deliverable; the embedded-texture GLBs are the browser deliverable.
"""

from pathlib import Path
import argparse
import math
import random
import sys

import bpy
from mathutils import Quaternion, Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "art" / "source"
EXPORT = ROOT / "public" / "art-sample"
TAU = math.tau
RNG = random.Random(271828)


def reset(name):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data in (bpy.data.meshes, bpy.data.curves, bpy.data.armatures,
                 bpy.data.materials, bpy.data.images, bpy.data.actions):
        for item in list(data):
            if item.users == 0:
                data.remove(item)
    bpy.context.scene.name = name
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.render.fps = 30
    bpy.context.scene.world.color = (0.22, 0.25, 0.30)
    bpy.context.scene["asset_provenance"] = "Original geometry, palette, texture, rig and motion authored for The Season."
    bpy.context.scene["coordinate_contract"] = "Meters; ground Z=0; front -Y; glTF front +Z and up +Y."


def painted_image(name, base, kind="stone", size=128):
    """A small original brushlike tile; no Blender-only shader nodes at runtime."""
    image = bpy.data.images.new(name, width=size, height=size, alpha=False)
    pixels = []
    seed = sum(ord(c) for c in name)
    noise = random.Random(seed)
    for y in range(size):
        v = y / size
        for x in range(size):
            u = x / size
            broad = math.sin(TAU * (u * 2 + v)) * math.sin(TAU * (v * 3 - u))
            soft = math.sin(TAU * (u * 5 + 0.17 * math.sin(v * TAU)))
            if kind == "wood":
                grain = math.sin(TAU * (u * 13 + 0.19 * math.sin(v * TAU)))
                value = 0.98 + 0.08 * broad + 0.045 * grain + noise.uniform(-0.018, 0.018)
            elif kind == "cloth":
                weave = (0.012 if x % 3 == 0 else 0) + (0.009 if y % 3 == 0 else 0)
                value = 1.0 + 0.035 * broad + weave + noise.uniform(-0.012, 0.012)
            else:
                value = 0.99 + 0.065 * broad + 0.025 * soft + noise.uniform(-0.025, 0.025)
            pixels.extend((min(1.0, c * value) for c in base))
            pixels.append(1.0)
    image.pixels.foreach_set(pixels)
    image.pack()
    return image


def material(name, color, roughness=0.85, texture=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    if texture:
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = painted_image(name + "_paint", color, texture)
        node.interpolation = "Linear"
        mat.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
    return mat


def uv_project(mesh):
    """Stable planar UVs for procedural meshes, without editor context or add-ons."""
    layer = mesh.uv_layers.new(name="PaintUV")
    for poly in mesh.polygons:
        normal = poly.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        for li in poly.loop_indices:
            p = mesh.vertices[mesh.loops[li].vertex_index].co
            if axis == 2:
                uv = (p.x, p.y)
            elif axis == 1:
                uv = (p.x, p.z)
            else:
                uv = (p.y, p.z)
            layer.data[li].uv = uv


def mesh_object(name, vertices, faces, mats, face_materials=None, smooth=False):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for mat in mats if isinstance(mats, list) else [mats]:
        mesh.materials.append(mat)
    for i, polygon in enumerate(mesh.polygons):
        polygon.use_smooth = smooth
        if face_materials:
            polygon.material_index = face_materials[i % len(face_materials)]
    uv_project(mesh)
    return obj


def bevel_box(name, center, size, mat, bevel=0.035, rotation=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    obj.rotation_euler.z = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Soft chipped edges", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        mod.affect = "EDGES"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def ellipsoid(name, center, radii, mat, subdivisions=2, rotation=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radii
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def tube(name, points, radii, mat, sides=9, twist=0, facets=None):
    """A continuous modeled branch/limb, not a stack of intersecting cylinders."""
    points = [Vector(p) for p in points]
    verts = []
    for i, point in enumerate(points):
        tangent = points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]
        tangent.normalize()
        reference = Vector((0, 1, 0)) if abs(tangent.y) < 0.9 else Vector((1, 0, 0))
        side = tangent.cross(reference).normalized()
        other = tangent.cross(side).normalized()
        radius = radii[i]
        rx, ry = radius if isinstance(radius, tuple) else (radius, radius)
        for j in range(sides):
            angle = TAU * j / sides + i * twist
            p = point + side * math.cos(angle) * rx + other * math.sin(angle) * ry
            verts.append(tuple(p))
    faces = [tuple(reversed(range(sides)))]
    for i in range(len(points) - 1):
        for j in range(sides):
            faces.append((i * sides + j, i * sides + (j + 1) % sides,
                          (i + 1) * sides + (j + 1) % sides, (i + 1) * sides + j))
    faces.append(tuple((len(points) - 1) * sides + j for j in range(sides)))
    return mesh_object(name, verts, faces, mat, facets)


def lathe(name, center, profile, mat, sides=16):
    verts = []
    for z, radius in profile:
        for i in range(sides):
            angle = TAU * i / sides
            verts.append((center[0] + radius * math.cos(angle),
                          center[1] + radius * math.sin(angle), center[2] + z))
    faces = []
    for row in range(len(profile) - 1):
        for i in range(sides):
            faces.append((row * sides + i, row * sides + (i + 1) % sides,
                          (row + 1) * sides + (i + 1) % sides, (row + 1) * sides + i))
    faces.append(tuple(reversed(range(sides))))
    return mesh_object(name, verts, faces, mat)


def join_meshes(name):
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    # Original authoring coordinates stay in the mesh; runtime origin is ground center.
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return obj


def save_asset(name, animated=False):
    SOURCE.mkdir(parents=True, exist_ok=True)
    EXPORT.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / (name + ".blend")))
    options = dict(filepath=str(EXPORT / (name + ".glb")), export_format="GLB",
                   export_yup=True, export_apply=False, export_animations=animated,
                   export_skins=True, export_materials="EXPORT", export_extras=True,
                   export_cameras=False, export_lights=False)
    if animated:
        options.update(export_animation_mode="NLA_TRACKS", export_force_sampling=True,
                       export_frame_range=False)
    bpy.ops.export_scene.gltf(**options)
    print("SEASON_ASSET", name, "meshes", sum(o.type == "MESH" for o in bpy.context.scene.objects),
          "triangles", sum(len(p.vertices) - 2 for o in bpy.context.scene.objects
                           if o.type == "MESH" for p in o.data.polygons))


def build_house():
    reset("The Season — Aenon limestone dwelling")
    plaster = material("Aenon warm lime plaster", (0.77, 0.64, 0.43), texture="stone")
    plaster_light = material("Sunwashed plaster edge", (0.87, 0.75, 0.54), texture="stone")
    stone = [material("Local limestone " + str(i), c, texture="stone") for i, c in enumerate([
        (0.61, 0.48, 0.31), (0.73, 0.60, 0.41), (0.79, 0.67, 0.48), (0.67, 0.53, 0.36)])]
    mortar = material("Recessed earth mortar", (0.39, 0.32, 0.23))
    timber = material("Weathered cedar", (0.29, 0.18, 0.095), texture="wood")
    timber_light = material("Worn timber ridges", (0.42, 0.28, 0.145), texture="wood")
    shadow = material("Doorway interior", (0.095, 0.09, 0.065))
    linen = material("Undyed flax awning", (0.75, 0.64, 0.42), texture="cloth")
    linen_stripe = material("Awning faded indigo stripe", (0.27, 0.37, 0.38), texture="cloth")
    pottery = material("Fired ochre terracotta", (0.56, 0.26, 0.13), texture="stone")
    rim = material("Terracotta lip", (0.70, 0.37, 0.20))
    iron = material("Forged iron", (0.10, 0.115, 0.10), roughness=0.65)

    # Exterior footprint 6 × 4.5 m; front wall includes genuinely recessed openings.
    bevel_box("Stone footing", (0, 0, 0.13), (6.18, 4.68, 0.26), mortar, 0.04)
    bevel_box("Back plaster", (0, 2.05, 1.77), (6.0, 0.40, 3.30), plaster)
    bevel_box("West plaster", (-2.80, 0, 1.77), (0.40, 4.15, 3.30), plaster)
    bevel_box("East plaster", (2.80, 0, 1.77), (0.40, 4.15, 3.30), plaster)
    # Front pieces separated at door and window aperture edges.
    front_y = -2.06
    # x spans and opening intervals (bottom, top) in meters.
    spans = [(-3.0, -2.18, None), (-2.18, -1.22, (1.35, 2.22)),
             (-1.22, -0.20, None), (-0.20, 1.02, (0.12, 2.38)),
             (1.02, 1.84, None), (1.84, 2.44, (1.62, 2.25)), (2.44, 3.0, None)]
    for index, (left, right, opening) in enumerate(spans):
        intervals = [(0.12, 3.42)] if opening is None else [(0.12, opening[0]), (opening[1], 3.42)]
        for low, high in intervals:
            if high - low > 0.02:
                bevel_box("Facade plaster %02d" % index, ((left + right) / 2, front_y, (low + high) / 2),
                          (right - left + 0.018, 0.40, high - low), plaster, 0.018)

    # Broad rounded roof lip and thick, slightly uneven parapet define the silhouette.
    bevel_box("Flat packed-earth roof", (0, 0, 3.39), (6.02, 4.52, 0.20), plaster_light, 0.065)
    bevel_box("Roof interior", (0, 0, 3.52), (5.37, 3.88, 0.08), stone[0], 0.035)
    for side, center, dims in [
        ("front", (0, -2.11, 3.67), (6.03, 0.30, 0.44)),
        ("back", (0, 2.11, 3.72), (6.03, 0.30, 0.51)),
        ("west", (-2.86, 0, 3.70), (0.30, 4.15, 0.47)),
        ("east", (2.86, 0, 3.69), (0.30, 4.15, 0.46))]:
        bevel_box("Rounded parapet " + side, center, dims, plaster_light, 0.085)
    # Individually modeled uneven capstones, with quiet broad texture variation.
    for y in [-2.12, 2.12]:
        for i in range(10):
            bevel_box("Parapet capstone", (-2.72 + i * 0.602, y, 3.95 + RNG.uniform(-0.012, 0.012)),
                      (0.585, 0.39, 0.11), stone[2], 0.032, RNG.uniform(-0.012, 0.012))
    for x in [-2.87, 2.87]:
        for i in range(6):
            bevel_box("Side parapet capstone", (x, -1.72 + i * 0.687, 3.95),
                      (0.39, 0.668, 0.11), stone[2], 0.032)

    # Visible limestone course work at foundation and corners, not an unrelated brick pattern.
    for row in range(3):
        z = 0.28 + row * 0.26
        for i in range(10):
            x = -2.73 + i * 0.60 + (0.23 if row % 2 else 0)
            if x > 2.93 or -0.32 < x < 1.18:
                continue
            bevel_box("Facade limestone course", (x, -2.285, z),
                      (RNG.uniform(0.50, 0.58), RNG.uniform(0.095, 0.15), 0.235), RNG.choice(stone), 0.045)
        for side in [-1, 1]:
            for i in range(7):
                bevel_box("Side limestone course", (side * 3.02, -1.89 + i * 0.63, z),
                          (0.12, RNG.uniform(0.53, 0.60), 0.235), RNG.choice(stone), 0.04)
    for x in [-2.92, 2.92]:
        for row in range(3, 12):
            z = 0.28 + row * 0.26
            length = 0.48 if row % 2 else 0.68
            bevel_box("Corner dressed stone", (x - math.copysign(length / 2 - 0.10, x), -2.278, z),
                      (length, 0.13, 0.235), RNG.choice(stone[1:]), 0.033)
    # Exposed weathered plaster patches are shallow, irregular stone islands.
    for x, z, width in [(-1.0, 1.01, 0.52), (1.58, 0.93, 0.70), (-2.37, 2.73, 0.42), (2.39, 1.03, 0.43)]:
        bevel_box("Weathered limestone showing through", (x, -2.278, z), (width, 0.095, 0.22), stone[1], 0.048)

    # Door frame, inset cedar boards, lintel, hand-forged hinges and loop handle.
    bevel_box("Dark door recess", (0.41, -1.98, 1.30), (1.24, 0.12, 2.30), shadow, 0.018)
    for x in [-0.31, 1.13]:
        for row in range(7):
            bevel_box("Door jamb stone", (x, -2.29, 0.29 + row * 0.315),
                      (0.27, 0.42, 0.298), stone[(row + 1) % 4], 0.035)
    bevel_box("Heavy limestone door lintel", (0.41, -2.275, 2.50), (1.79, 0.48, 0.27), stone[2], 0.055)
    for i in range(7):
        bevel_box("Door cedar board", (-0.11 + i * 0.173, -2.03, 1.23), (0.163, 0.14, 2.15),
                  timber_light if i in [1, 4] else timber, 0.016)
    for z in [0.61, 1.91]:
        bevel_box("Door transverse brace", (0.40, -2.126, z), (1.12, 0.07, 0.12), timber_light, 0.012)
        bevel_box("Door iron hinge", (-0.05, -2.174, z), (0.42, 0.025, 0.044), iron, 0.008)
    bpy.ops.mesh.primitive_torus_add(major_segments=16, minor_segments=5,
                                   location=(0.80, -2.17, 1.15), rotation=(math.pi / 2, 0, 0),
                                   major_radius=0.053, minor_radius=0.010)
    bpy.context.object.name = "Forged door ring"
    bpy.context.object.data.materials.append(iron)
    for step in range(3):
        bevel_box("Limestone doorstep", (0.42, -2.48 - (2 - step) * 0.27, 0.045 + step * 0.045),
                  (1.55 + (2 - step) * 0.18, 0.39, 0.09 + step * 0.09), stone[2], 0.035)

    for wx, wz, ww, wh in [(-1.70, 1.80, 0.94, 0.85), (2.14, 1.945, 0.60, 0.61)]:
        bevel_box("Window darkness", (wx, -1.99, wz), (ww, 0.08, wh), shadow, 0)
        for sx in [-1, 1]:
            bevel_box("Window timber side", (wx + sx * (ww / 2 + 0.015), -2.19, wz), (0.10, 0.16, wh + 0.20), timber_light, 0.014)
        for sz in [-1, 1]:
            bevel_box("Window timber rail", (wx, -2.19, wz + sz * (wh / 2 + 0.02)), (ww + 0.12, 0.16, 0.10), timber_light, 0.014)
        for i in range(4):
            bevel_box("Window cedar grille", (wx - ww * 0.32 + i * ww * 0.215, -2.105, wz), (0.038, 0.055, wh), timber, 0.007)
        bevel_box("Projecting limestone window sill", (wx, -2.30, wz - wh / 2 - 0.10), (ww + 0.34, 0.42, 0.14), stone[2], 0.035)
    # One open shutter catches light and gives the front depth.
    shutter = bevel_box("Open cedar shutter", (-2.44, -2.50, 1.79), (0.48, 0.08, 0.86), timber, 0.020, -0.42)
    for z in [1.53, 2.07]:
        bevel_box("Shutter brace", (-2.44, -2.55, z), (0.49, 0.045, 0.085), timber_light, 0.01, -0.42)

    # Curved, slightly sagging flax cloth canopy; stripes are sewn geometry sections.
    awning_x = -1.45
    width = 2.42
    rows = 8
    cols = 12
    vertices = []
    for row in range(rows + 1):
        t = row / rows
        for col in range(cols + 1):
            u = col / cols
            z = 2.85 - 0.26 * t - 0.13 * math.sin(math.pi * t) - 0.035 * math.sin(math.pi * u)
            vertices.append((awning_x - width / 2 + width * u, -2.32 - t * 1.36, z))
    faces, indices = [], []
    for row in range(rows):
        for col in range(cols):
            start = row * (cols + 1) + col
            faces.append((start, start + 1, start + cols + 2, start + cols + 1))
            indices.append(1 if col in [1, 2, 9, 10] else 0)
    cloth = mesh_object("Woven flax awning", vertices, faces, [linen, linen_stripe], indices)
    cloth.data.materials[0].use_backface_culling = False
    for i in range(12):
        x = awning_x - width / 2 + (i + 0.5) * width / 12
        bevel_box("Awning cloth hanging edge", (x, -3.69, 2.515), (width / 12 + 0.004, 0.018, 0.16),
                  linen_stripe if i in [1, 2, 9, 10] else linen, 0.005)
    for x in [awning_x - width / 2 + 0.06, awning_x + width / 2 - 0.06]:
        tube("Canopy cedar post", [(x, -3.60, 0.05), (x + 0.025, -3.60, 1.30), (x, -3.60, 2.66)], [0.062, 0.055, 0.048], timber, 7)
        tube("Canopy brace", [(x, -3.60, 2.20), (x, -3.20, 2.69)], [0.032, 0.03], timber_light, 6)
    tube("Awning front beam", [(awning_x - width / 2 - 0.07, -3.62, 2.59),
                               (awning_x + width / 2 + 0.07, -3.62, 2.59)], [0.055, 0.047], timber, 8)

    # Hollow pottery with modeled lips and handles, not closed cylinders.
    for index, (x, y, scale) in enumerate([(-2.26, -2.66, 1.0), (-1.69, -2.55, 0.72), (1.65, -2.62, 0.88)]):
        profile = [(0, 0.15), (0.09, 0.23), (0.35, 0.30), (0.57, 0.25),
                   (0.67, 0.14), (0.75, 0.135), (0.78, 0.155), (0.78, 0.113),
                   (0.70, 0.107), (0.60, 0.15)]
        lathe("Storage jar %d" % index, (x, y, 0.03), [(z * scale, r * scale) for z, r in profile], pottery)
        lathe("Jar rolled lip", (x, y, 0.03), [(0.745 * scale, 0.144 * scale), (0.78 * scale, 0.16 * scale),
                                             (0.79 * scale, 0.12 * scale)], rim)
        for side in [-1, 1]:
            points = [(x + side * 0.13 * scale, y, 0.71 * scale),
                      (x + side * 0.32 * scale, y, 0.65 * scale),
                      (x + side * 0.34 * scale, y, 0.47 * scale),
                      (x + side * 0.245 * scale, y, 0.42 * scale)]
            tube("Jar hand-formed handle", points, [0.03 * scale] * 4, pottery, 7)
    # Roof-stored wood and a projecting rain spout tell a small domestic story.
    for i in range(5):
        tube("Roof bundled cedar", [(-1.3 + i * 0.14, 0.55, 3.65), (-1.25 + i * 0.14, 1.65, 3.68)], [0.045, 0.037], timber_light, 7)
    bevel_box("Limestone rain spout", (3.13, 0.9, 3.55), (0.54, 0.28, 0.17), stone[2], 0.035)
    house = join_meshes("AenonHouse")
    house["description"] = "Original lime-plastered Galilean dwelling with cedar awning, local limestone and hand-formed jars."
    save_asset("house")


def build_olive():
    reset("The Season — old Jordan olive")
    bark = [material("Olive bark " + str(i), c, texture="wood") for i, c in enumerate([
        (0.30, 0.265, 0.18), (0.43, 0.38, 0.25), (0.22, 0.215, 0.155), (0.51, 0.45, 0.30)])]
    leaves = [material("Olive leaf canopy " + str(i), c) for i, c in enumerate([
        (0.085, 0.145, 0.045), (0.13, 0.225, 0.065), (0.18, 0.28, 0.095),
        (0.25, 0.35, 0.14), (0.17, 0.265, 0.13), (0.36, 0.405, 0.235)])]
    fruit = material("Olive fruit muted plum", (0.16, 0.20, 0.115))
    trunk_points = [(0, 0, 0), (0.11, 0.02, 0.32), (-0.08, 0.11, 0.84),
                    (-0.16, 0.08, 1.27), (0.03, 0.14, 1.76), (0.04, 0.07, 2.12)]
    tube("Ancient twisting olive trunk", trunk_points, [(0.48, 0.36), (0.36, 0.31), (0.30, 0.26),
         (0.25, 0.23), (0.225, 0.20), (0.16, 0.15)], bark, 12, twist=0.23,
         facets=[0, 1, 0, 2, 0, 1, 3, 0, 2, 0, 1, 0])
    # Long tapered roots and winding raised ridges give the old trunk its character.
    for i in range(7):
        a = i * TAU / 7 + 0.2
        end = (math.cos(a) * RNG.uniform(0.65, 1.04), math.sin(a) * RNG.uniform(0.65, 1.04), 0.025)
        tube("Olive spreading root", [(0.04, 0.03, 0.30), (end[0] * 0.52, end[1] * 0.52, 0.11), end],
             [(0.19, 0.11), (0.115, 0.06), (0.008, 0.008)], bark[i % 4], 7)
    for i in range(9):
        a = i * TAU / 9
        ridge = []
        for j, (x, y, z) in enumerate(trunk_points[:-1]):
            r = [0.37, 0.30, 0.265, 0.23, 0.20][j]
            ridge.append((x + math.cos(a + j * 0.21) * r, y + math.sin(a + j * 0.21) * r, z + 0.03))
        tube("Twisting bark ridge", ridge, [0.065, 0.052, 0.046, 0.032, 0.012], bark[(i + 1) % 4], 5)

    clusters = []
    # The open center and staggered branch reaches form an irregular Mediterranean crown.
    for i, (angle, reach, height) in enumerate([(0.2, 1.55, 3.35), (1.05, 1.62, 3.85),
        (2.0, 1.48, 3.55), (2.95, 1.63, 3.45), (3.95, 1.45, 3.93), (5.05, 1.76, 3.38)]):
        dx, dy = math.cos(angle), math.sin(angle)
        base = trunk_points[3 if i % 2 else 4]
        p1 = (dx * 0.50 - 0.03, dy * 0.50 + 0.09, 2.27 + (i % 2) * 0.16)
        p2 = (dx * 1.04, dy * 1.04, height - 0.62)
        p3 = (dx * reach, dy * reach, height - 0.13)
        tube("Olive main bough %d" % i, [base, p1, p2, p3], [0.205, 0.16, 0.098, 0.035], bark,
             9, twist=0.1, facets=[0, 1, 0, 2, 0, 1, 0, 3, 0])
        clusters.append((p3, (1.03, 0.88, 0.55)))
        for side in [-1, 1]:
            branch_angle = angle + side * 0.59
            endpoint = (p2[0] + math.cos(branch_angle) * 0.81,
                        p2[1] + math.sin(branch_angle) * 0.81, height + RNG.uniform(-0.17, 0.28))
            tube("Olive fork", [p1, p2, endpoint], [0.085, 0.058, 0.019], bark[(i + 1) % 4], 7)
            clusters.append((endpoint, (0.80, 0.69, 0.43)))
    clusters.append(((0.04, 0.12, 4.18), (0.96, 0.80, 0.60)))
    tube("Olive high stem", [trunk_points[-1], (0.2, 0.02, 3.13), (0.05, 0.12, 4.1)], [0.14, 0.075, 0.023], bark[0], 8)

    for ci, (center, radius) in enumerate(clusters):
        # Each crown is a custom asymmetric folded foliage shell; no smooth green spheres.
        verts = [(center[0], center[1], center[2] - radius[2] * 0.76)]
        for row, (zfactor, rfactor) in enumerate([(-0.42, 0.67), (-0.08, 1.0), (0.32, 0.83), (0.68, 0.43)]):
            for j in range(11):
                angle = TAU * j / 11 + (row % 2) * 0.19
                rr = rfactor * RNG.uniform(0.83, 1.14)
                verts.append((center[0] + math.cos(angle) * radius[0] * rr,
                              center[1] + math.sin(angle) * radius[1] * rr,
                              center[2] + radius[2] * (zfactor + RNG.uniform(-0.13, 0.13))))
        verts.append((center[0] + 0.1, center[1] - 0.06, center[2] + radius[2] * 0.92))
        faces, mids = [], []
        for j in range(11):
            faces.append((0, 1 + (j + 1) % 11, 1 + j)); mids.append(0 if j % 2 else 4)
        for row in range(3):
            for j in range(11):
                a = 1 + row * 11 + j
                b = 1 + row * 11 + (j + 1) % 11
                c = 1 + (row + 1) * 11 + (j + 1) % 11
                d = 1 + (row + 1) * 11 + j
                faces.extend([(a, b, d), (b, c, d)])
                mids.extend([RNG.choice([1, 2, 4] if row == 0 else [1, 2, 2, 3, 3, 5])] * 2)
        for j in range(11):
            faces.append((45, 34 + j, 34 + (j + 1) % 11)); mids.append(RNG.choice([2, 3, 3, 3, 5]))
        mesh_object("Layered olive crown %02d" % ci, verts, faces, leaves, mids)

        # Narrow folded lanceolate leaves break the shell edges and establish olive identity.
        leaf_verts, leaf_faces, leaf_mids = [], [], []
        for n in range(76):
            angle = RNG.uniform(0, TAU)
            elev = RNG.uniform(-0.45, 1.15)
            p = Vector((center[0] + math.cos(angle) * radius[0] * math.cos(elev) * RNG.uniform(0.85, 1.04),
                        center[1] + math.sin(angle) * radius[1] * math.cos(elev) * RNG.uniform(0.85, 1.04),
                        center[2] + math.sin(elev) * radius[2] * 0.82))
            direction = Vector((math.cos(angle + 0.3), math.sin(angle + 0.3), RNG.uniform(-0.35, 0.6))).normalized()
            across = direction.cross(Vector((0, 0, 1))).normalized()
            length, width = RNG.uniform(0.16, 0.26), RNG.uniform(0.030, 0.045)
            start = len(leaf_verts)
            leaf_verts.extend([tuple(p - direction * length / 2), tuple(p + across * width),
                               tuple(p + Vector((0, 0, 0.027))), tuple(p - across * width),
                               tuple(p + direction * length / 2)])
            leaf_faces.extend([(start, start + 1, start + 2), (start + 1, start + 4, start + 2),
                               (start, start + 2, start + 3), (start + 2, start + 4, start + 3)])
            mi = RNG.choice([1, 2, 2, 3, 3, 4, 5])
            leaf_mids.extend([mi, mi, max(0, mi - 1), max(0, mi - 1)])
        leaf_obj = mesh_object("Silver-green olive leaves", leaf_verts, leaf_faces, leaves, leaf_mids)
        for mat in leaf_obj.data.materials:
            mat.use_backface_culling = False
        if ci % 3 == 0:
            for j in range(3):
                angle = j * 2.1 + ci
                ellipsoid("Small olive fruit", (center[0] + math.cos(angle) * radius[0] * 0.75,
                          center[1] + math.sin(angle) * radius[1] * 0.75, center[2] - radius[2] * 0.32),
                          (0.033, 0.029, 0.055), fruit, 1)
    tree = join_meshes("JordanOlive")
    tree["description"] = "Original old olive with spiraled bark, open branching and silver-green lanceolate foliage."
    save_asset("olive")


def bind(obj, rig, weights):
    """weights: bone name or callable taking world-space vertex -> {bone: weight}."""
    obj.parent = rig
    modifier = obj.modifiers.new("Original Adventurer skin", "ARMATURE")
    modifier.object = rig
    groups = {}
    for vertex in obj.data.vertices:
        point = obj.matrix_world @ vertex.co
        assignment = {weights: 1.0} if isinstance(weights, str) else weights(point)
        for bone, weight in assignment.items():
            if weight <= 0:
                continue
            if bone not in groups:
                groups[bone] = obj.vertex_groups.new(name=bone)
            groups[bone].add([vertex.index], weight, "REPLACE")
    return obj


def build_adventurer():
    reset("The Season — original Adventurer rig")
    linen = material("Adventurer unbleached linen", (0.76, 0.68, 0.49), texture="cloth")
    linen_light = material("Adventurer linen edging", (0.89, 0.80, 0.60), texture="cloth")
    linen_shadow = material("Adventurer linen fold", (0.57, 0.52, 0.36), texture="cloth")
    sash = material("Adventurer madder sash", (0.39, 0.16, 0.10), texture="cloth")
    leather = material("Adventurer worn leather", (0.23, 0.14, 0.075), texture="wood")
    leather_light = material("Adventurer leather edge", (0.38, 0.25, 0.12))
    skin = material("Adventurer warm skin", (0.53, 0.33, 0.19))
    skin_light = material("Adventurer skin light", (0.64, 0.43, 0.27))
    hair = material("Adventurer dark hair", (0.095, 0.075, 0.052))
    hair_light = material("Adventurer hair ridges", (0.155, 0.12, 0.075))
    eyes = material("Adventurer eyes", (0.045, 0.045, 0.032))
    trouser = material("Adventurer olive wool trousers", (0.27, 0.28, 0.17), texture="cloth")
    metal = material("Adventurer bronze clasp", (0.53, 0.38, 0.16), roughness=0.57)

    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    rig = bpy.context.object
    rig.name = "AdventurerRig"
    rig.data.name = "AdventurerOriginalArmature"
    rig.data.edit_bones.remove(rig.data.edit_bones[0])
    bones = {}
    def bone(name, head, tail, parent=None, connect=False):
        b = rig.data.edit_bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = bones[parent]
            b.use_connect = connect
        bones[name] = b
    bone("Root", (0, 0, 0.01), (0, 0, 0.18))
    bone("Pelvis", (0, 0, 0.83), (0, 0, 1.01), "Root")
    bone("Spine", (0, 0, 1.01), (0, 0, 1.21), "Pelvis", True)
    bone("Chest", (0, 0, 1.21), (0, 0, 1.40), "Spine", True)
    bone("Neck", (0, 0, 1.40), (0, 0, 1.47), "Chest", True)
    bone("Head", (0, 0, 1.47), (0, 0, 1.69), "Neck", True)
    for side, sign in [("L", 1), ("R", -1)]:
        bone("UpperArm." + side, (sign * 0.215, 0, 1.36), (sign * 0.30, 0.0, 1.10), "Chest")
        bone("Forearm." + side, (sign * 0.30, 0, 1.10), (sign * 0.325, -0.025, 0.885), "UpperArm." + side, True)
        bone("Hand." + side, (sign * 0.325, -0.025, 0.885), (sign * 0.33, -0.04, 0.775), "Forearm." + side, True)
        bone("Thigh." + side, (sign * 0.105, 0, 0.86), (sign * 0.112, 0.012, 0.49), "Pelvis")
        bone("Shin." + side, (sign * 0.112, 0.012, 0.49), (sign * 0.113, 0, 0.13), "Thigh." + side, True)
        bone("Foot." + side, (sign * 0.113, 0, 0.13), (sign * 0.113, -0.145, 0.065), "Shin." + side, True)
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    rig["forward"] = "Blender -Y; exported glTF +Z"
    rig["motion"] = "Idle and Run are original in-place loops; runtime owns world translation. Run: 3.2 m/s at ratio 1."

    def torso_weights(p):
        if p.z < 1.00:
            return {"Pelvis": 1.0}
        if p.z < 1.20:
            t = (p.z - 1.00) / 0.20
            return {"Spine": 1 - t * 0.45, "Chest": t * 0.45}
        return {"Chest": 1.0}
    # Continuous shaped torso and flared tunic, with intentional fold geometry.
    rings = [(0.72, 0.225, 0.133), (0.83, 0.209, 0.123), (0.96, 0.176, 0.109),
             (1.04, 0.167, 0.112), (1.20, 0.197, 0.130), (1.33, 0.228, 0.129),
             (1.385, 0.192, 0.103)]
    verts, faces, mids = [], [], []
    sides = 16
    for ri, (z, rx, ry) in enumerate(rings):
        for j in range(sides):
            angle = TAU * j / sides
            fold = 1 + (0.052 if j % 2 else -0.02) * (1 if ri < 3 else 0.5)
            verts.append((math.cos(angle) * rx * fold, math.sin(angle) * ry * fold, z + (0.014 * math.cos(j * 2.1) if ri == 0 else 0)))
    for ri in range(len(rings) - 1):
        for j in range(sides):
            faces.append((ri * sides + j, ri * sides + (j + 1) % sides,
                          (ri + 1) * sides + (j + 1) % sides, (ri + 1) * sides + j))
            mids.append(2 if j in [2, 7, 10, 14] else 0)
    faces.append(tuple((len(rings) - 1) * sides + j for j in range(sides))); mids.append(1)
    bind(mesh_object("Adventurer shaped linen tunic", verts, faces, [linen, linen_light, linen_shadow], mids), rig, torso_weights)
    bind(lathe("Tunic sewn lower hem", (0, 0, 0), [(0.722, 0.220), (0.75, 0.220)], linen_light), rig, "Pelvis")
    # The hem above is flattened in depth to follow the cloth skirt.
    hem = bpy.context.scene.objects.get("Tunic sewn lower hem")
    for v in hem.data.vertices:
        v.co.y *= 0.61
    # Neck opening and collar as an actual open ring.
    bind(lathe("Linen collar", (0, 0, 1.37), [(0, 0.106), (0.035, 0.085), (0.035, 0.068), (0.0, 0.073)], linen_light, 12), rig, "Chest")
    bind(tube("Neck", [(0, 0.008, 1.365), (0, 0.005, 1.49)], [0.069, 0.069], skin, 10), rig, "Neck")

    # Wrapped waist sash with a knot and a hanging, folded tail.
    belt = lathe("Wrapped madder waist sash", (0, 0, 0), [(0.96, 0.18), (1.005, 0.183), (1.045, 0.175)], sash, 16)
    for v in belt.data.vertices:
        v.co.y *= 0.65
    bind(belt, rig, "Spine")
    bind(ellipsoid("Sash knot", (-0.142, -0.091, 0.99), (0.054, 0.042, 0.051), sash, 1), rig, "Spine")
    sash_verts = [(-0.167, -0.126, 0.985), (-0.095, -0.139, 0.987), (-0.109, -0.161, 0.78),
                  (-0.160, -0.154, 0.715), (-0.189, -0.151, 0.757), (-0.18, -0.149, 0.866)]
    bind(mesh_object("Folded hanging sash", sash_verts, [(0, 1, 2, 5), (5, 2, 3, 4)], [sash, linen_shadow], [0, 0]), rig, "Pelvis")
    # A slender cross-body bag strap traces the front and back contours.
    for front in [-1, 1]:
        points = [(-0.17, front * 0.075, 1.36), (-0.09, front * 0.143, 1.24),
                  (0.0, front * 0.140, 1.12), (0.15, front * 0.121, 0.96)]
        verts = []
        for p in points:
            verts.extend([(p[0] - 0.021, p[1], p[2] - 0.011), (p[0] + 0.021, p[1], p[2] + 0.011)])
        bind(mesh_object("Cross-body leather strap", verts, [(0, 1, 3, 2), (2, 3, 5, 4), (4, 5, 7, 6)], leather), rig, torso_weights)
    bind(bevel_box("Leather satchel", (0.209, 0.025, 0.862), (0.145, 0.14, 0.20), leather, 0.036, -0.14), rig, "Pelvis")
    bind(bevel_box("Satchel folded flap", (0.211, -0.053, 0.91), (0.151, 0.025, 0.105), leather_light, 0.018, -0.14), rig, "Pelvis")
    bind(ellipsoid("Satchel bronze button", (0.213, -0.074, 0.885), (0.014, 0.007, 0.014), metal, 1), rig, "Pelvis")

    for side, sign in [("L", 1), ("R", -1)]:
        upper, fore, hand = "UpperArm." + side, "Forearm." + side, "Hand." + side
        thigh, shin, foot = "Thigh." + side, "Shin." + side, "Foot." + side
        bind(tube("Linen sleeve " + side, [(sign * 0.205, 0, 1.34), (sign * 0.26, 0, 1.205), (sign * 0.282, 0, 1.145)],
                  [(0.107, 0.10), (0.091, 0.089), (0.085, 0.08)], linen, 10), rig, upper)
        bind(tube("Sleeve sewn cuff " + side, [(sign * 0.278, 0, 1.17), (sign * 0.287, 0, 1.139)],
                  [0.086, 0.087], linen_light, 10), rig, upper)
        bind(tube("Upper arm " + side, [(sign * 0.26, 0, 1.22), (sign * 0.30, 0, 1.105)], [0.064, 0.055], skin, 10), rig, upper)
        def arm_weights(p, side=side):
            t = max(0, min(1, (1.125 - p.z) / 0.07))
            return {"UpperArm." + side: 1 - t, "Forearm." + side: t}
        bind(tube("Forearm " + side, [(sign * 0.30, 0, 1.12), (sign * 0.316, -0.013, 1.00), (sign * 0.325, -0.025, 0.878)],
                  [0.055, 0.056, 0.038], skin, 10), rig, arm_weights)
        bind(tube("Wrist leather tie " + side, [(sign * 0.324, -0.025, 0.896), (sign * 0.327, -0.028, 0.919)], [0.040, 0.042], leather, 10), rig, fore)
        bind(ellipsoid("Hand " + side, (sign * 0.329, -0.034, 0.829), (0.047, 0.032, 0.064), skin_light, 2), rig, hand)
        bind(tube("Thumb " + side, [(sign * 0.292, -0.033, 0.851), (sign * 0.286, -0.045, 0.815)], [0.019, 0.014], skin, 7), rig, hand)
        # Blended knee weights allow actual deformation between the thigh and shin.
        def leg_weights(p, side=side):
            t = max(0, min(1, (0.54 - p.z) / 0.105))
            return {"Thigh." + side: 1 - t, "Shin." + side: t}
        bind(tube("Wool trouser leg " + side, [(sign * 0.105, 0, 0.86), (sign * 0.108, 0.003, 0.66),
                   (sign * 0.112, 0.012, 0.49), (sign * 0.113, 0.005, 0.37)],
                  [(0.091, 0.095), (0.083, 0.079), (0.066, 0.068), (0.061, 0.06)], trouser, 12), rig, leg_weights)
        bind(tube("Lower calf " + side, [(sign * 0.113, 0.005, 0.39), (sign * 0.113, 0.007, 0.275), (sign * 0.113, 0, 0.122)],
                  [0.054, 0.052, 0.036], skin, 10), rig, shin)
        bind(tube("Trouser cuff " + side, [(sign * 0.113, 0.005, 0.38), (sign * 0.113, 0.005, 0.41)], [0.066, 0.064], linen_shadow, 12), rig, shin)
        bind(bevel_box("Leather sandal sole " + side, (sign * 0.113, -0.063, 0.025), (0.14, 0.255, 0.045), leather, 0.034), rig, foot)
        bind(ellipsoid("Foot " + side, (sign * 0.113, -0.061, 0.073), (0.064, 0.119, 0.044), skin_light, 2), rig, foot)
        for y, z in [(-0.125, 0.097), (-0.037, 0.108)]:
            bind(tube("Sandal cross strap " + side, [(sign * 0.113 - 0.064, y, 0.044),
                       (sign * 0.113 - 0.035, y, z), (sign * 0.113 + 0.035, y, z),
                       (sign * 0.113 + 0.064, y, 0.044)], [0.011] * 4, leather_light, 6), rig, foot)
        bind(tube("Sandal ankle tie " + side, [(sign * 0.15, 0.005, 0.126), (sign * 0.113, -0.034, 0.165),
                   (sign * 0.076, 0.005, 0.126)], [0.008] * 3, leather, 6), rig, foot)

    # Faceted facial anatomy. Dark eyes and brows remain restrained at the game camera.
    head = ellipsoid("Adventurer face", (0, -0.011, 1.575), (0.118, 0.103, 0.150), skin_light, 3)
    for vertex in head.data.vertices:
        if vertex.co.z < -0.055:
            vertex.co.x *= 0.84
    bind(head, rig, "Head")
    bind(ellipsoid("Jaw plane", (0, -0.055, 1.505), (0.082, 0.059, 0.048), skin, 2), rig, "Head")
    nose_verts = [(-0.020, -0.096, 1.608), (0.020, -0.096, 1.608), (-0.022, -0.116, 1.552),
                  (0.022, -0.116, 1.552), (0, -0.146, 1.566)]
    bind(mesh_object("Modeled nose", nose_verts, [(0, 4, 1), (0, 2, 4), (1, 4, 3), (2, 3, 4)], skin_light), rig, "Head")
    for sign in [-1, 1]:
        bind(ellipsoid("Ear", (sign * 0.118, -0.003, 1.577), (0.023, 0.035, 0.047), skin, 2), rig, "Head")
        bind(ellipsoid("Eye", (sign * 0.043, -0.105, 1.600), (0.017, 0.008, 0.009), eyes, 1), rig, "Head")
        bind(tube("Brow", [(sign * 0.022, -0.109, 1.622), (sign * 0.053, -0.104, 1.624),
                           (sign * 0.066, -0.097, 1.618)], [0.007, 0.008, 0.004], hair, 5), rig, "Head")
    bind(tube("Mouth", [(-0.025, -0.105, 1.529), (0, -0.109, 1.524), (0.025, -0.105, 1.529)], [0.003, 0.004, 0.003], skin, 5), rig, "Head")
    # Sculpted hair cap and curved locks; none of this is a borrowed character/rig.
    hair_verts = [(0, 0.012, 1.743)]
    for row, (z, rx, ry) in enumerate([(1.705, 0.091, 0.08), (1.665, 0.122, 0.101), (1.618, 0.121, 0.100)]):
        for j in range(16):
            a = TAU * j / 16
            # A higher front hairline, lower temple/back, swept asymmetrical fringe.
            zz = z + (0.024 * max(0, -math.sin(a)) if row == 2 else 0)
            hair_verts.append((math.cos(a) * rx, 0.009 + math.sin(a) * ry, zz))
    hair_faces = [(0, 1 + j, 1 + (j + 1) % 16) for j in range(16)]
    for row in range(2):
        for j in range(16):
            hair_faces.append((1 + row * 16 + j, 1 + row * 16 + (j + 1) % 16,
                               17 + row * 16 + (j + 1) % 16, 17 + row * 16 + j))
    bind(mesh_object("Original sculpted hair cap", hair_verts, hair_faces, [hair, hair_light], [0, 0, 1, 0, 0]), rig, "Head")
    for i in range(7):
        x = -0.09 + i * 0.027
        bind(tube("Swept hair lock", [(x - 0.015, -0.030, 1.724 - abs(x) * 0.24),
                   (x + 0.025, -0.085, 1.686 - abs(x) * 0.23),
                   (x + 0.014, -0.094, 1.644 + i * 0.002)], [0.022, 0.025, 0.009], hair if i % 3 else hair_light, 6), rig, "Head")
    for sign in [-1, 1]:
        bind(tube("Temple hair", [(sign * 0.112, 0.005, 1.648), (sign * 0.117, -0.005, 1.598),
                                 (sign * 0.109, -0.022, 1.566)], [0.027, 0.021, 0.008], hair, 7), rig, "Head")

    # A single skinned mesh/material palette minimizes scene overhead while preserving bones.
    adventurer = join_meshes("Adventurer")
    adventurer.parent = rig
    adventurer["description"] = "Original linen-clad Adventurer; original armature, skin weights and two in-place clips."
    # The elevated game camera benefits from broader planes and clear limb spacing.
    # Widen the original mesh and rest skeleton together, leaving object scale at 1.
    for vertex in adventurer.data.vertices:
        vertex.co.x *= 1.15
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    rest_endpoints = {b.name: (b.head.copy(), b.tail.copy()) for b in rig.data.edit_bones}
    for b in rig.data.edit_bones:
        head, tail = rest_endpoints[b.name]
        head.x *= 1.15
        tail.x *= 1.15
        b.head, b.tail = head, tail
    bpy.ops.object.mode_set(mode="OBJECT")
    animate_adventurer(rig)
    save_asset("adventurer", animated=True)


def animate_adventurer(rig):
    rig.animation_data_create()
    for pose in rig.pose.bones:
        pose.rotation_mode = "XYZ"

    def aim_bone(name, head, tail):
        """Orient a bone in armature space without guessing its local axis signs."""
        rest = rig.data.bones[name]
        rest_direction = (rest.tail_local - rest.head_local).normalized()
        direction = (tail - head).normalized()
        rotation = rest_direction.rotation_difference(direction) @ rest.matrix_local.to_quaternion()
        matrix = rotation.to_matrix().to_4x4()
        matrix.translation = head
        rig.pose.bones[name].matrix = matrix
        bpy.context.view_layer.update()

    def place_leg(side, u):
        # A complete run cycle is 2/3 s. Support lasts 30% of the cycle and
        # travels 0.64 m relative to the body: 3.2 m/s cancels it in world space.
        # Hip -> knee -> ankle is solved in world space with a forward knee pole.
        rest_thigh = rig.data.bones["Thigh." + side]
        rest_shin = rig.data.bones["Shin." + side]
        rest_foot = rig.data.bones["Foot." + side]
        pelvis = rig.pose.bones["Pelvis"]
        hip = pelvis.matrix @ rig.data.bones["Pelvis"].matrix_local.inverted() @ rest_thigh.head_local
        swing = u >= 0.30
        if not swing:
            forward = -0.32 + (0.64 / 0.30) * u
            height = 0.0
            toe_angle = 0.0
        else:
            t = (u - 0.30) / 0.70
            ease = t * t * (3 - 2 * t)
            forward = 0.32 - 0.64 * ease
            height = 0.16 * math.sin(math.pi * t)
            toe_angle = -0.12 * math.sin(math.pi * t)
        ankle = Vector((rest_foot.head_local.x, forward, rest_foot.head_local.z + height))
        direction = ankle - hip
        distance = direction.length
        direction.normalize()
        upper, lower = rest_thigh.length, rest_shin.length
        if distance >= upper + lower - 0.001:
            raise ValueError("Run target exceeds original leg reach: " + side)
        along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
        bend = Vector((0, -1, 0))
        bend = (bend - direction * bend.dot(direction)).normalized()
        knee = hip + direction * along + bend * math.sqrt(max(0, upper * upper - along * along))
        aim_bone("Thigh." + side, hip, knee)
        aim_bone("Shin." + side, knee, ankle)
        # Keep the supporting sole level; give only the lifted foot a slight toe-up.
        rotation = Quaternion((1, 0, 0), toe_angle) @ rest_foot.matrix_local.to_quaternion()
        foot_matrix = rotation.to_matrix().to_4x4()
        foot_matrix.translation = ankle
        rig.pose.bones["Foot." + side].matrix = foot_matrix
        bpy.context.view_layer.update()

    def place_arm(side, phase):
        # Bone roll is deliberately irrelevant here: swing about the body's
        # sagittal axis rather than each slanted arm bone's local Euler X.
        upper = rig.data.bones["UpperArm." + side]
        fore = rig.data.bones["Forearm." + side]
        hand = rig.data.bones["Hand." + side]
        chest_delta = rig.pose.bones["Chest"].matrix @ rig.data.bones["Chest"].matrix_local.inverted()
        shoulder = chest_delta @ upper.head_local
        chest_rotation = chest_delta.to_quaternion()
        swing = 0.43 * math.cos(phase)
        elbow = shoulder + chest_rotation @ (Quaternion((1, 0, 0), swing) @ (upper.tail_local - upper.head_local))
        fore_rotation = chest_rotation @ Quaternion((1, 0, 0), swing - 1.04 + 0.065 * math.cos(phase))
        wrist = elbow + fore_rotation @ (fore.tail_local - fore.head_local)
        fingertips = wrist + fore_rotation @ (hand.tail_local - hand.head_local)
        aim_bone("UpperArm." + side, shoulder, elbow)
        aim_bone("Forearm." + side, elbow, wrist)
        aim_bone("Hand." + side, wrist, fingertips)

    for clip, end in [("Idle", 61), ("Run", 21)]:
        rig.animation_data.action = None
        for frame in range(1, end + 1):
            # Build the pose without an active action re-evaluating earlier keys
            # during the world-space solve's dependency-graph updates.
            action_in_progress = rig.animation_data.action
            rig.animation_data.action = None
            t = (frame - 1) / (end - 1)
            phase = TAU * t
            for pose in rig.pose.bones:
                pose.rotation_euler = (0, 0, 0)
                pose.location = (0, 0, 0)
                pose.scale = (1, 1, 1)
            if clip == "Idle":
                breath = math.sin(phase)
                rig.pose.bones["Chest"].rotation_euler.x = 0.012 * breath
                rig.pose.bones["Head"].rotation_euler.z = 0.013 * math.sin(phase + 0.3)
                rig.pose.bones["Pelvis"].location.y = 0.003 * breath
                for side, sign in [("L", 1), ("R", -1)]:
                    rig.pose.bones["UpperArm." + side].rotation_euler.x = 0.017 * breath
                    rig.pose.bones["Forearm." + side].rotation_euler.x = -0.05 + 0.009 * breath
            else:
                # Body compression during support, then a small airborne spring.
                # Pelvis local Y points up; spine/neck keep the forward lean relaxed.
                step = (t % 0.5) * 2
                if step < 0.60:
                    drop = -0.08 - 0.015 * math.sin(math.pi * step / 0.60)
                else:
                    drop = -0.08 + 0.06 * math.sin(math.pi * (step - 0.60) / 0.40)
                rig.pose.bones["Pelvis"].location.y = drop
                rig.pose.bones["Pelvis"].location.x = 0.005 * math.sin(phase)
                rig.pose.bones["Pelvis"].rotation_euler.y = 0.018 * math.sin(phase)
                rig.pose.bones["Chest"].rotation_euler.y = -0.048 * math.sin(phase)
                rig.pose.bones["Chest"].rotation_euler.x = 0.105
                rig.pose.bones["Head"].rotation_euler.x = -0.05
                bpy.context.view_layer.update()
                place_leg("L", t % 1.0)
                place_leg("R", (t + 0.5) % 1.0)
                place_arm("L", phase)
                place_arm("R", phase + math.pi)
            rig.animation_data.action = action_in_progress
            for pose in rig.pose.bones:
                pose.keyframe_insert(data_path="rotation_euler", frame=frame, group=pose.name)
                pose.keyframe_insert(data_path="location", frame=frame, group=pose.name)
        action = rig.animation_data.action
        action.name = clip
        action.use_fake_user = True
        track = rig.animation_data.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip, 1, action)
        strip.action_frame_start = 1
        strip.action_frame_end = end
        strip.blend_type = "REPLACE"
        # Separate muted authoring tracks are exported one at a time by NLA_TRACKS.
        track.mute = True
    rig.animation_data.action = None
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 61
    for pose in rig.pose.bones:
        pose.rotation_euler = (0, 0, 0)
        pose.location = (0, 0, 0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=["house", "olive", "adventurer", "all"], default="all")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    for name, builder in [("house", build_house), ("olive", build_olive), ("adventurer", build_adventurer)]:
        if args.asset in (name, "all"):
            RNG.seed(271828 + ["house", "olive", "adventurer"].index(name))
            builder()
    print("THE_SEASON_ORIGINAL_SAMPLE_COMPLETE", EXPORT)


if __name__ == "__main__":
    main()
