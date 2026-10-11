"""Original The Season gameplay assets, using our original sample as the human base.

Blender 4.5: --background --python scripts/art/build_gameplay.py [-- --asset NAME]
The approved sample Adventurer source and Idle/Run actions are never rewritten.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import math
import random
import struct
import sys

import bpy
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "game-assets"
SOURCE = ROOT / "art" / "source"
spec = importlib.util.spec_from_file_location("season_original_sample", Path(__file__).with_name("build_sample.py"))
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)
RNG = random.Random(29031)
TAU = math.tau


def rest_pose(rig):
    for b in rig.pose.bones:
        b.rotation_mode = "XYZ"
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)


def aim(rig, name, head, tail):
    bone = rig.data.bones[name]
    q = (bone.tail_local - bone.head_local).normalized().rotation_difference((tail - head).normalized())
    matrix = (q @ bone.matrix_local.to_quaternion()).to_matrix().to_4x4()
    matrix.translation = head
    rig.pose.bones[name].matrix = matrix
    bpy.context.view_layer.update()


def author_clip(rig, name, frames, pose):
    rig.animation_data_create()
    rig.animation_data.action = None
    for frame in range(1, frames + 1):
        action = rig.animation_data.action
        rig.animation_data.action = None
        rest_pose(rig)
        pose((frame - 1) / (frames - 1))
        rig.animation_data.action = action
        for b in rig.pose.bones:
            b.keyframe_insert(data_path="rotation_euler", frame=frame, group=b.name)
            b.keyframe_insert(data_path="location", frame=frame, group=b.name)
    action = rig.animation_data.action
    action.name = name
    action.use_fake_user = True
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, action)
    strip.action_frame_end = frames
    strip.blend_type = "REPLACE"
    track.mute = True
    rig.animation_data.action = None
    rest_pose(rig)


def export(name, save_source=True):
    OUT.mkdir(parents=True, exist_ok=True)
    SOURCE.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.frame_set(1)
    bpy.context.scene.render.fps = 30
    if save_source:
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / (name + ".blend")))
    path = OUT / (name + ".glb")
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_yup=True,
        export_apply=False, export_animations=True, export_skins=True, export_extras=True,
        export_animation_mode="NLA_TRACKS", export_force_sampling=True,
        export_frame_range=False, export_cameras=False, export_lights=False)
    data = path.read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + size])
    binary = data[28 + size:]
    dimensions = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
    for a in document.get("accessors", []):
        if a["componentType"] != 5126 or "bufferView" not in a:
            continue
        v = document["bufferViews"][a["bufferView"]]
        count = dimensions[a["type"]]
        offset = v.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = v.get("byteStride", count * 4)
        for i in range(a["count"]):
            if not all(math.isfinite(x) for x in struct.unpack_from("<" + "f" * count, binary, offset + i * stride)):
                raise ValueError("Invalid floating-point data in " + name)
    print("GAME_ASSET", name, "clips", [a["name"] for a in document.get("animations", [])],
          "skins", len(document.get("skins", [])), "bytes", path.stat().st_size, flush=True)


def load_human():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "adventurer.blend"))
    rig = bpy.data.objects["AdventurerRig"]
    rig.animation_data.action = None
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    rest_pose(rig)
    return rig


def arm(rig, side, swing, bend, outward=0):
    upper, fore, hand = [rig.data.bones[n + "." + side] for n in ("UpperArm", "Forearm", "Hand")]
    chest = rig.pose.bones["Chest"].matrix @ rig.data.bones["Chest"].matrix_local.inverted()
    rotation = chest.to_quaternion() @ Quaternion((0, 0, 1), outward)
    shoulder = chest @ upper.head_local
    elbow = shoulder + rotation @ (Quaternion((1, 0, 0), swing) @ (upper.tail_local - upper.head_local))
    fore_rotation = rotation @ Quaternion((1, 0, 0), swing + bend)
    wrist = elbow + fore_rotation @ (fore.tail_local - fore.head_local)
    tip = wrist + fore_rotation @ (hand.tail_local - hand.head_local)
    aim(rig, "UpperArm." + side, shoulder, elbow)
    aim(rig, "Forearm." + side, elbow, wrist)
    aim(rig, "Hand." + side, wrist, tip)


def keyed_curve(t, keys):
    for (ta, va), (tb, vb) in zip(keys, keys[1:]):
        if t <= tb:
            u = max(0, (t - ta) / (tb - ta))
            u = u * u * (3 - 2 * u)
            return va + (vb - va) * u
    return keys[-1][1]


def add_human_actions(rig):
    def attack(t):
        swing = keyed_curve(t, [(0, -0.08), (0.30, -2.08), (0.53, -0.52), (0.78, -0.44), (1, -0.08)])
        rig.pose.bones["Chest"].rotation_euler.x = 0.10 * math.sin(math.pi * t)
        rig.pose.bones["Chest"].rotation_euler.y = 0.15 * math.sin(TAU * t)
        bpy.context.view_layer.update()
        arm(rig, "R", swing, -0.20, -0.10 * math.sin(math.pi * t))
        arm(rig, "L", -0.40 * math.sin(math.pi * t), -0.65 * math.sin(math.pi * t))
    def gather(t):
        swing = keyed_curve(t, [(0, -0.25), (0.33, -1.83), (0.59, -0.50), (0.78, -0.46), (1, -0.25)])
        rig.pose.bones["Chest"].rotation_euler.x = 0.16 * math.sin(math.pi * t) ** 2
        bpy.context.view_layer.update()
        arm(rig, "R", swing, -0.24)
        arm(rig, "L", swing * 0.72, -0.35, 0.09)
    def guard(t):
        rig.pose.bones["Chest"].rotation_euler.x = 0.065 + 0.009 * math.sin(TAU * t)
        bpy.context.view_layer.update()
        arm(rig, "L", -0.70, -0.92, -0.25)
        arm(rig, "R", -0.32, -0.73)
    def hit(t):
        recoil = math.sin(math.pi * t)
        rig.pose.bones["Chest"].rotation_euler.x = -0.19 * recoil
        rig.pose.bones["Head"].rotation_euler.x = -0.08 * recoil
        bpy.context.view_layer.update()
        arm(rig, "L", 0.20 * recoil, -0.10)
        arm(rig, "R", 0.20 * recoil, -0.10)
    for name, frames, pose in [("Attack", 25, attack), ("Gather", 37, gather),
                               ("Guard", 31, guard), ("Hit", 13, hit)]:
        author_clip(rig, name, frames, pose)


def player():
    rig = load_human()
    add_human_actions(rig)
    export("adventurer", save_source=False)


def wolf():
    art.reset("The Season — original Jordan wolf")
    fur = art.material("Wolf warm grey guard hair", (0.24, 0.245, 0.20))
    dark = art.material("Wolf dark dorsal coat", (0.105, 0.125, 0.105))
    cream = art.material("Wolf cream undercoat", (0.47, 0.43, 0.31))
    light = art.material("Wolf sunlit fur edges", (0.34, 0.35, 0.27))
    black = art.material("Wolf nose and lips", (0.035, 0.042, 0.031))
    mouth = art.material("Wolf mouth", (0.12, 0.052, 0.035))
    eye = art.material("Wolf amber eyes", (0.56, 0.34, 0.075), roughness=0.48)
    teeth = art.material("Wolf teeth", (0.78, 0.73, 0.54))
    bpy.ops.object.armature_add(enter_editmode=True)
    rig = bpy.context.object
    rig.name = "WolfRig"
    rig.data.edit_bones.remove(rig.data.edit_bones[0])
    bones = {}
    def bone(name, head, tail, parent=None, connect=False):
        b = rig.data.edit_bones.new(name)
        b.head, b.tail = head, tail
        if parent:
            b.parent = bones[parent]
            b.use_connect = connect
        bones[name] = b
    bone("Root", (0, 0, 0), (0, 0, 0.20))
    bone("Spine", (0, 0.27, 0.64), (0, -0.27, 0.69), "Root")
    bone("Neck", (0, -0.27, 0.69), (0, -0.58, 0.79), "Spine", True)
    bone("Head", (0, -0.58, 0.79), (0, -0.89, 0.735), "Neck", True)
    bone("Jaw", (0, -0.61, 0.705), (0, -0.94, 0.675), "Head")
    bone("Tail1", (0, 0.46, 0.65), (0.04, 0.80, 0.43), "Spine")
    bone("Tail2", (0.04, 0.80, 0.43), (0.075, 1.10, 0.33), "Tail1", True)
    for prefix, sign in [("FL", 1), ("FR", -1), ("HL", 1), ("HR", -1)]:
        front = prefix.startswith("F")
        x = sign * 0.17
        hip = (x, -0.30, 0.68) if front else (x, 0.34, 0.65)
        knee = (x, -0.32, 0.39) if front else (x, 0.20, 0.38)
        ankle = (x, -0.36, 0.10) if front else (x, 0.40, 0.13)
        toe = (x, -0.46, 0.055) if front else (x, 0.26, 0.055)
        bone(prefix + "Upper", hip, knee, "Spine")
        bone(prefix + "Lower", knee, ankle, prefix + "Upper", True)
        bone(prefix + "Paw", ankle, toe, prefix + "Lower", True)
    bpy.ops.object.mode_set(mode="OBJECT")
    rig["original_art"] = "Original The Season wolf: geometry, rig, skin and animation."
    rig["run_speed"] = "3.0 m/s at playback ratio 1; 0.6-second diagonal gait."
    def bind(obj, bone):
        return art.bind(obj, rig, bone)
    bind(art.ellipsoid("Wolf shaped ribcage", (0, -0.04, 0.66), (0.215, 0.48, 0.245), fur, 3), "Spine")
    bind(art.ellipsoid("Wolf tapered abdomen", (0, 0.25, 0.62), (0.174, 0.29, 0.17), fur, 2), "Spine")
    bind(art.ellipsoid("Wolf shoulder ruff", (0, -0.30, 0.74), (0.245, 0.24, 0.24), dark, 2), "Spine")
    bind(art.ellipsoid("Wolf chest bib", (0, -0.36, 0.59), (0.165, 0.16, 0.19), cream, 2), "Spine")
    bind(art.tube("Wolf rising neck", [(0, -0.33, 0.71), (0, -0.48, 0.79), (0, -0.59, 0.80)],
                  [(0.20, 0.18), (0.16, 0.15), (0.13, 0.13)], fur, 12), "Neck")
    bind(art.ellipsoid("Wolf angular skull", (0, -0.65, 0.81), (0.145, 0.21, 0.155), fur, 2), "Head")
    bind(art.tube("Wolf tapered muzzle", [(0, -0.72, 0.755), (0, -0.85, 0.735), (0, -0.98, 0.725)],
                  [(0.088, 0.082), (0.065, 0.063), (0.048, 0.040)], cream, 10), "Head")
    bind(art.ellipsoid("Wolf nose", (0, -1.00, 0.731), (0.050, 0.037, 0.035), black, 2), "Head")
    bind(art.tube("Wolf lower jaw", [(0, -0.64, 0.701), (0, -0.81, 0.678), (0, -0.96, 0.682)],
                  [(0.092, 0.043), (0.062, 0.026), (0.038, 0.022)], cream, 9), "Jaw")
    bind(art.tube("Wolf mouth interior", [(0, -0.71, 0.716), (0, -0.93, 0.701)], [0.057, 0.035], mouth, 8), "Jaw")
    for sign in [-1, 1]:
        bind(art.ellipsoid("Wolf amber eye", (sign * 0.109, -0.758, 0.827), (0.025, 0.015, 0.014), eye, 1), "Head")
        bind(art.ellipsoid("Wolf dark pupil", (sign * 0.115, -0.771, 0.828), (0.010, 0.005, 0.011), black, 1), "Head")
        vertices = [(sign * 0.049, -0.62, 0.89), (sign * 0.14, -0.61, 0.88),
                    (sign * 0.127, -0.55, 1.075), (sign * 0.073, -0.51, 0.89)]
        bind(art.mesh_object("Wolf pointed ear", vertices, [(0, 1, 2), (1, 3, 2), (3, 0, 2)], [dark, fur], [0, 1, 1]), "Head")
        bind(art.mesh_object("Wolf ear inner", [(sign * 0.068, -0.627, 0.912), (sign * 0.127, -0.620, 0.913),
                                                (sign * 0.121, -0.565, 1.044)], [(0, 1, 2)], cream), "Head")
        for y in [-0.78, -0.86]:
            bind(art.tube("Wolf canine tooth", [(sign * 0.049, y, 0.728), (sign * 0.043, y, 0.694)], [0.013, 0.002], teeth, 6), "Head")
    # Modeled guard-hair tufts keep the coat angular and readable at game distance.
    for i in range(24):
        y = RNG.uniform(-0.42, 0.35)
        sign = RNG.choice([-1, 1])
        x = sign * RNG.uniform(0.13, 0.20)
        z = RNG.uniform(0.67, 0.85)
        vertices = [(x, y - 0.055, z), (x, y + 0.045, z + 0.015),
                    (x + sign * 0.07, y + 0.095, z - 0.095), (x + sign * 0.026, y - 0.01, z - 0.06)]
        bind(art.mesh_object("Wolf layered guard hair", vertices, [(0, 1, 2), (0, 2, 3)], dark if i % 3 else light), "Spine")
    for prefix in ["FL", "FR", "HL", "HR"]:
        upper, lower, paw = [rig.data.bones[prefix + suffix] for suffix in ["Upper", "Lower", "Paw"]]
        front = prefix.startswith("F")
        a, b, c, d = upper.head_local, upper.tail_local, lower.tail_local, paw.tail_local
        bind(art.tube("Wolf upper leg " + prefix, [a, a.lerp(b, 0.5), b],
                      [0.095 if front else 0.12, 0.075 if front else 0.093, 0.047], fur, 10), upper.name)
        def leg_weights(p, prefix=prefix, knee=b.copy()):
            t = min(1, max(0, (knee.z + 0.04 - p.z) / 0.08))
            return {prefix + "Upper": 1 - t, prefix + "Lower": t}
        bind(art.tube("Wolf tapered shank " + prefix, [b, b.lerp(c, 0.55), c], [0.047, 0.035, 0.028], light, 9), leg_weights)
        center = c.lerp(d, 0.65)
        center.z = 0.055
        bind(art.ellipsoid("Wolf paw " + prefix, center, (0.061, 0.095, 0.050), cream, 2), paw.name)
        for side in [-1, 0, 1]:
            bind(art.ellipsoid("Wolf toe " + prefix, (center.x + side * 0.026, center.y - 0.060, 0.040),
                               (0.021, 0.037, 0.031), fur, 1), paw.name)
    bind(art.tube("Wolf brush tail base", [(0, 0.45, 0.66), (0.04, 0.65, 0.51), (0.04, 0.80, 0.43)], [0.085, 0.10, 0.085], dark, 10), "Tail1")
    bind(art.tube("Wolf brush tail tip", [(0.04, 0.80, 0.43), (0.065, 0.98, 0.34), (0.075, 1.12, 0.32)], [0.085, 0.065, 0.006], dark, 10), "Tail2")
    mesh = art.join_meshes("JordanWolf")
    mesh.parent = rig
    wolf_actions(rig)
    export("wolf")


def wolf_actions(rig):
    def idle(t):
        rig.pose.bones["Neck"].rotation_euler.x = 0.018 * math.sin(TAU * t)
        rig.pose.bones["Tail1"].rotation_euler.y = 0.07 * math.sin(TAU * t)
    def run(t):
        phase = TAU * t
        rig.pose.bones["Root"].location.y = -0.102 + 0.010 * math.cos(phase * 2)
        rig.pose.bones["Neck"].rotation_euler.x = 0.045 * math.sin(phase * 2)
        rig.pose.bones["Tail1"].rotation_euler.y = 0.075 * math.sin(phase)
        bpy.context.view_layer.update()
        delta = rig.pose.bones["Spine"].matrix @ rig.data.bones["Spine"].matrix_local.inverted()
        for prefix, offset in [("FL", 0), ("HR", 0), ("FR", 0.5), ("HL", 0.5)]:
            u = (t + offset) % 1
            if u < 0.26:
                travel, lift = -0.234 + 0.468 * u / 0.26, 0
            else:
                s = (u - 0.26) / 0.74
                travel = 0.234 - 0.468 * s * s * (3 - 2 * s)
                lift = 0.13 * math.sin(math.pi * s)
            upper, lower, paw = [rig.data.bones[prefix + suffix] for suffix in ["Upper", "Lower", "Paw"]]
            hip = delta @ upper.head_local
            ankle = paw.head_local.copy() + Vector((0, travel, lift))
            direction = ankle - hip
            distance = direction.length
            direction.normalize()
            if distance >= upper.length + lower.length:
                raise ValueError("Wolf gait target beyond leg reach: " + prefix)
            along = (upper.length ** 2 - lower.length ** 2 + distance ** 2) / (2 * distance)
            pole = Vector((0, 1 if prefix.startswith("F") else -1, 0))
            pole = (pole - direction * pole.dot(direction)).normalized()
            knee = hip + direction * along + pole * math.sqrt(max(0, upper.length ** 2 - along ** 2))
            aim(rig, upper.name, hip, knee)
            aim(rig, lower.name, knee, ankle)
            matrix = paw.matrix_local.copy()
            matrix.translation = ankle
            rig.pose.bones[paw.name].matrix = matrix
            bpy.context.view_layer.update()
    def attack(t):
        pulse = math.sin(math.pi * t)
        rig.pose.bones["Neck"].rotation_euler.x = -0.18 * pulse
        rig.pose.bones["Head"].rotation_euler.x = 0.27 * pulse
        rig.pose.bones["Jaw"].rotation_euler.x = 0.60 * math.sin(math.pi * min(1, t / 0.65))
        rig.pose.bones["Root"].location.z = 0.11 * pulse
    def hit(t):
        pulse = math.sin(math.pi * t)
        rig.pose.bones["Neck"].rotation_euler.x = -0.12 * pulse
        rig.pose.bones["Root"].location.x = 0.06 * pulse
        rig.pose.bones["Tail1"].rotation_euler.x = -0.18 * pulse
    def death(t):
        u = min(1, t / 0.75)
        u = u * u * (3 - 2 * u)
        rotation = Quaternion((0, 1, 0), -math.pi * 0.5 * u)
        pivot = Vector((0, 0, 0.62))
        target = pivot.lerp(Vector((-0.035, 0, 0.25)), u)
        transform = rotation.to_matrix().to_4x4()
        transform.translation = target - rotation @ pivot
        rig.pose.bones["Root"].matrix = transform @ rig.data.bones["Root"].matrix_local
        rig.pose.bones["Neck"].rotation_euler.x = 0.17 * u
        rig.pose.bones["Jaw"].rotation_euler.x = 0.16 * u
        rig.pose.bones["Tail1"].rotation_euler.x = 0.22 * u
    for name, frames, pose in [("Idle", 61, idle), ("Run", 19, run), ("Attack", 22, attack),
                               ("Hit", 13, hit), ("Death", 34, death)]:
        author_clip(rig, name, frames, pose)


def recolor_human(name, colors):
    mesh = bpy.data.objects["Adventurer"]
    replacements = {suffix: art.material(name + " " + suffix, color, texture="cloth")
                    for suffix, color in colors.items()}
    for slot in mesh.material_slots:
        for suffix, mat in replacements.items():
            if slot.material.name == "Adventurer " + suffix:
                slot.material = mat
    return mesh


def human_variant(name):
    rig = load_human()
    if name == "john":
        body = art.material("John camel-hair robe", (0.42, 0.31, 0.18), texture="cloth")
        edge = art.material("John sunbleached camel hair", (0.57, 0.44, 0.27), texture="cloth")
        hair = art.material("John dark long hair", (0.115, 0.090, 0.055))
        grey = art.material("John beard silver-brown strands", (0.28, 0.245, 0.17))
        recolor_human("John", {"unbleached linen": (0.42, 0.31, 0.18), "linen edging": (0.55, 0.41, 0.25),
                               "madder sash": (0.24, 0.145, 0.075), "linen fold": (0.32, 0.23, 0.12)})
        rings = [(0.15, 0.272, 0.175), (0.40, 0.265, 0.161), (0.72, 0.24, 0.148),
                 (0.98, 0.199, 0.13), (1.20, 0.222, 0.148), (1.36, 0.264, 0.14)]
        vertices = []
        for ri, (z, x, y) in enumerate(rings):
            for j in range(20):
                a = TAU * j / 20
                fold = 1.06 if j % 2 else 0.97
                vertices.append((math.cos(a) * x * fold, math.sin(a) * y * fold,
                                 z + (0.017 * math.sin(j * 2.1) if ri == 0 else 0)))
        faces, mids = [], []
        for ri in range(len(rings) - 1):
            for j in range(20):
                faces.append((ri * 20 + j, ri * 20 + (j + 1) % 20,
                              (ri + 1) * 20 + (j + 1) % 20, (ri + 1) * 20 + j))
                mids.append(1 if j % 5 == 1 else 0)
        def robe_weights(p):
            return {"Pelvis": 1} if p.z < 1 else {"Chest": 1}
        art.bind(art.mesh_object("John long camel-hair robe", vertices, faces, [body, edge], mids), rig, robe_weights)
        for i in range(9):
            x = -0.095 + i * 0.0235
            art.bind(art.tube("John beard lock", [(x, -0.075, 1.532), (x * 0.84, -0.116, 1.41),
                         (x * 0.53, -0.10, 1.29 + abs(x) * 0.75)], [0.027, 0.025, 0.006],
                         grey if i in [1, 6] else hair, 7), rig, "Head")
        for angle in [0, 0.6, 1.2, 1.8, 2.4, math.pi]:
            x, y = math.cos(angle) * 0.126, math.sin(angle) * 0.108
            art.bind(art.tube("John shoulder-length hair", [(x, y, 1.67), (x * 1.1, y, 1.49),
                         (x * 1.10, y + 0.016, 1.36)], [0.038, 0.033, 0.012], hair, 7), rig, "Head")
    elif name == "merchant":
        recolor_human("Vendor", {"unbleached linen": (0.17, 0.36, 0.34), "linen edging": (0.75, 0.58, 0.29),
                                  "madder sash": (0.47, 0.22, 0.14), "linen fold": (0.12, 0.26, 0.24)})
        wrap = art.material("Vendor cream linen head wrap", (0.75, 0.68, 0.50), texture="cloth")
        shawl = art.material("Vendor dyed terracotta shawl", (0.47, 0.22, 0.14), texture="cloth")
        gold = art.material("Vendor ochre edging", (0.69, 0.46, 0.18), texture="cloth")
        art.bind(art.lathe("Vendor wrapped headcloth", (0, 0.006, 1.655), [(0, 0.132), (0.05, 0.14),
                         (0.095, 0.108), (0.13, 0.055), (0.14, 0.0)], wrap, 16), rig, "Head")
        for z in [1.67, 1.71]:
            art.bind(art.lathe("Vendor headcloth woven band", (0, 0.006, z), [(0, 0.14), (0.016, 0.143)], gold, 16), rig, "Head")
        vertices = [(-0.14, -0.02, 1.43), (-0.30, 0.045, 1.37), (-0.29, 0.19, 1.02),
                    (-0.11, 0.155, 0.93), (-0.07, 0.09, 1.32),
                    (-0.20, -0.15, 1.34), (-0.27, -0.15, 0.87), (-0.16, -0.15, 0.85)]
        art.bind(art.mesh_object("Vendor draped shoulder shawl", vertices,
                 [(0, 1, 2, 3, 4), (0, 5, 6, 7, 4)], [shawl, gold], [0, 0]), rig, "Chest")
        art.bind(art.tube("Vendor shawl tassel", [(-0.205, -0.145, 0.88), (-0.212, -0.151, 0.79)],
                          [0.021, 0.007], gold, 6), rig, "Chest")
    else:
        recolor_human("Bandit", {"unbleached linen": (0.23, 0.255, 0.18), "linen edging": (0.32, 0.31, 0.21),
                                 "madder sash": (0.34, 0.15, 0.08), "linen fold": (0.14, 0.17, 0.10)})
        hood = art.material("Bandit rough earth-brown hood", (0.19, 0.16, 0.105), texture="cloth")
        trim = art.material("Bandit worn hood edges", (0.31, 0.255, 0.15), texture="cloth")
        verts = []
        for z, rx, ry in [(1.37, 0.185, 0.12), (1.59, 0.151, 0.12), (1.73, 0.138, 0.112)]:
            for j in range(13):
                a = -0.17 + (math.pi + 0.34) * j / 12
                verts.append((math.cos(a) * rx, 0.026 + math.sin(a) * ry, z))
        verts.append((0, 0.005, 1.805))
        faces = []
        for row in range(2):
            for j in range(12):
                faces.append((row * 13 + j, row * 13 + j + 1, (row + 1) * 13 + j + 1, (row + 1) * 13 + j))
        for j in range(12):
            faces.append((26 + j, 26 + j + 1, 39))
        art.bind(art.mesh_object("Bandit open hood", verts, faces, hood), rig, "Head")
        for sign in [-1, 1]:
            art.bind(art.tube("Bandit modeled hood rim", [(sign * 0.18, -0.002, 1.37),
                        (sign * 0.155, -0.010, 1.59), (sign * 0.137, -0.013, 1.73), (0, 0.005, 1.805)],
                        [0.015, 0.016, 0.014, 0.009], trim, 6), rig, "Head")
        cape = [(-0.245, 0.10, 1.37), (0.245, 0.10, 1.37), (0.265, 0.22, 0.95),
                (0.11, 0.22, 0.82), (-0.05, 0.21, 0.89), (-0.27, 0.20, 0.86)]
        art.bind(art.mesh_object("Bandit short rough cloak", cape, [(0, 1, 2, 3, 4, 5)], hood), rig, "Chest")
        add_human_actions(rig)
        def death(t):
            u = min(1, t / 0.75)
            u = u * u * (3 - 2 * u)
            q = Quaternion((1, 0, 0), -math.pi * 0.5 * u)
            pivot = Vector((0, 0, 0.82))
            target = pivot.lerp(Vector((0, 0.10, 0.18)), u)
            transform = q.to_matrix().to_4x4()
            transform.translation = target - q @ pivot
            rig.pose.bones["Root"].matrix = transform @ rig.data.bones["Root"].matrix_local
        author_clip(rig, "Death", 34, death)
    mesh = art.join_meshes({"john": "JohnCamelHair", "merchant": "AenonVendor", "bandit": "WildernessBandit"}[name])
    mesh.parent = rig
    mesh["original_variant"] = "Distinct original " + name + " authored from The Season's own Adventurer."
    export(name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", choices=["adventurer", "wolf", "john", "merchant", "bandit", "all"], default="all")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    builders = [("adventurer", player), ("wolf", wolf), ("john", lambda: human_variant("john")),
                ("merchant", lambda: human_variant("merchant")), ("bandit", lambda: human_variant("bandit"))]
    for name, builder in builders:
        if args.asset in (name, "all"):
            builder()


if __name__ == "__main__":
    main()
