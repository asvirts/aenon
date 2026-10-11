"""Architecture intake for #58. Blender 5.2: blender -b --python scripts/art/build_architecture.py.

Imported Anker/Quaternius CC0 meshes are retained in art/vendor/architecture.
The assembly is authored in metres: Blender X/lateral, Y/forward, Z/up. Export rotates the assembly so
Blender -Y becomes game +Z in the host’s right-handed, Y-up scene.
Outputs are uncompressed source GLBs; scripts/art/optimize.mjs builds runtime files.
"""
from pathlib import Path
import bpy, math, json, argparse, sys
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
VENDOR=ROOT/'art/vendor/architecture'
TEXTURES=ROOT/'art/vendor/3dtextures/architecture'
OUT=ROOT/'art/source/architecture'
OUT.mkdir(parents=True,exist_ok=True)


def clear():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)


def material(name,color,texture=None,normal=None,roughness=None):
    mat=bpy.data.materials.new(name); mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value=(*color,1); bsdf.inputs['Roughness'].default_value=.87
    if texture:
        node=mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image=bpy.data.images.load(str(TEXTURES/texture),check_existing=True)
        # A 512px seamless surface is sufficient at the furthest supported camera.
        if node.image.size[0]>512: node.image.scale(512,512)
        # Bake tint into the pixels, because glTF exports one base-color texture.
        image=node.image.copy(); image.name=name+'-basecolor'
        pixels=list(image.pixels[:])
        for i in range(0,len(pixels),4):
            for c in range(3):
                value=pixels[i+c]
                if texture.startswith('stone-wall/'):value=.58+.6*value
                elif texture.startswith('plaster/'):value=.24+.7*value
                pixels[i+c]=min(1,value*color[c])
        image.pixels[:]=pixels; image.pack(); node.image=image
        mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
        bsdf.inputs['Base Color'].default_value=(1,1,1,1)
    if normal:
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load(str(TEXTURES/normal),check_existing=True); tex.image.colorspace_settings.name='Non-Color'
        if tex.image.size[0]>512: tex.image.scale(512,512)
        bump=mat.node_tree.nodes.new('ShaderNodeNormalMap'); bump.inputs['Strength'].default_value=.45
        mat.node_tree.links.new(tex.outputs['Color'],bump.inputs['Color']);mat.node_tree.links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    if roughness:
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(TEXTURES/roughness),check_existing=True);tex.image.colorspace_settings.name='Non-Color'
        if tex.image.size[0]>512:tex.image.scale(512,512)
        mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Roughness'])
    return mat

plaster='plaster/Plaster_002_COLOR.jpg'
stone='stone-wall/Stylized_Stone_Wall_002_basecolor.png'; stoneN='stone-wall/Stylized_Stone_Wall_002_normal.png'; stoneR='stone-wall/Stylized_Stone_Wall_002_roughness.png'
wood='wood/Stylized_Wood_Planks_002_basecolor.png'; woodN='wood/Stylized_Wood_Planks_002_normal.png';woodR='wood/Stylized_Wood_Planks_002_roughness.png'
M={
'plaster':material('3dtextures-lime-plaster',(.96,.86,.69),plaster),
'mud':material('3dtextures-sun-dried-mud-plaster',(.72,.46,.29),plaster),
'limestone':material('3dtextures-dressed-limestone',(.94,.86,.68),stone,stoneN,stoneR),
'cap':material('3dtextures-limestone-coping',(1,.96,.85),plaster),
'wood':material('3dtextures-aged-wood',(.69,.53,.36),wood,woodN,woodR),
'darkwood':material('3dtextures-oiled-wood',(.4,.3,.21),wood,woodN,woodR),
'linen':material('woven-linen',(.7,.59,.4)),
'indigo':material('faded-indigo-cloth',(.19,.32,.38)),
'ochre':material('ochre-wool',(.55,.27,.12)),
'clay':material('fired-clay',(.53,.27,.15)),
'grain':material('dry-grain',(.57,.44,.22)),
'rope':material('twisted-flax-rope',(.48,.37,.2)),
'dark':material('recess-shadow',(.11,.09,.07)),
}


def apply(o,mat):
    o.data.materials.clear();o.data.materials.append(M[mat]);return o


def uv(o):
    # Metre-scaled box projection keeps blockwork and plaster grain consistent
    # across a complete facade, coping stones and little courtyard additions.
    layer=o.data.uv_layers.active or o.data.uv_layers.new(name='Surface-metres')
    for face in o.data.polygons:
        axis=max(range(3),key=lambda i:abs(face.normal[i]))
        axes=[i for i in range(3) if i!=axis]
        for loop in face.loop_indices:
            v=o.data.vertices[o.data.loops[loop].vertex_index].co
            layer.data[loop].uv=(v[axes[0]]/2,v[axes[1]]/2)


def box(name,size,pos,mat,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);apply(o,mat)
    if bevel:
        mod=o.modifiers.new('hand-worn-edges','BEVEL');mod.width=bevel;mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    uv(o);return o


def beam(name,a,b,width,mat='wood'):
    a,b=Vector(a),Vector(b);o=box(name,(width,width,(b-a).length),(a+b)/2,mat,width*.15);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o


def lathe(name,profile,pos,mat,segments=16):
    vs=[];faces=[]
    for r,z in profile:
        for i in range(segments):
            a=i*math.tau/segments;vs.append((pos[0]+r*math.cos(a),pos[1]+r*math.sin(a),pos[2]+z))
    for row in range(len(profile)-1):
        for i in range(segments):
            a=row*segments+i;b=row*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);apply(o,mat);uv(o);return o


def cloth(name,x,y,z,width,depth,mat):
    vs=[];faces=[]
    for j in range(5):
        for i in range(9):
            u=i/8;v=j/4;vs.append((x+(u-.5)*width,y+(v-.5)*depth,z-.12*math.sin(u*math.pi)+.035*math.sin(u*6*math.pi)))
    for j in range(4):
        for i in range(8):
            a=j*9+i;faces.append((a,a+1,a+10,a+9))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);apply(o,mat);uv(o)
    # The visible underside needs geometry, rather than relying on backface settings.
    bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('cloth-edge','SOLIDIFY');mod.thickness=.014;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def imported(pack,name,size,pos=(0,0,0),rotation=0,wall='plaster'):
    bpy.ops.object.select_all(action='DESELECT');bpy.ops.import_scene.fbx(filepath=str(VENDOR/pack/name))
    objects=[o for o in bpy.context.selected_objects if o.type=='MESH']
    for o in objects:
        bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        for v in o.data.vertices:
            x,y,z=v.co;v.co=(x*math.cos(rotation)-y*math.sin(rotation),x*math.sin(rotation)+y*math.cos(rotation),z)
    points=[v.co for o in objects for v in o.data.vertices];lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    for o in objects:
        for v in o.data.vertices:
            v.co=Vector(tuple((v.co[i]-lo[i])/(hi[i]-lo[i])*size[i]+pos[i]-(size[i]/2 if i<2 else 0) for i in range(3)))
        for slot in o.material_slots:
            old=slot.material.name.lower() if slot.material else ''
            slot.material=M[('wood' if 'brown' in old else 'cap' if 'beige 2' in old else wall) if pack=='anker' else 'wood']
        if not o.data.materials:apply(o,wall)
        if name.startswith('Awning'):
            for slot in o.material_slots:
                if slot.material in [M['plaster'],M['cap']]: slot.material=M['linen']
        o.name=pack+'-'+name[:-4];uv(o)
    return objects


def column(x,y,h=2.45):
    lathe('dressed-column-shaft',[(.23,0),(.25,.12),(.2,.2),(.16,.27),(.145,h-.28),(.21,h-.2),(.24,h-.12)],(x,y,0),'limestone',12)
    box('column-plinth',(.56,.56,.13),(x,y,.065),'limestone')
    box('plain-capital',(.53,.53,.15),(x,y,h-.035),'cap')


def jar(x,y,z=0):
    lathe('wheel-thrown-storage-jar',[(.16,0),(.25,.06),(.32,.36),(.22,.61),(.115,.67),(.12,.73),(.08,.73),(.08,.64)],(x,y,z),'clay')


def rack(x,y,z):
    for a in [-.72,.72]:beam('drying-rack-upright',(x+a,y,z),(x+a,y,z+.65),.065)
    for a in [-.72,0,.72]:beam('drying-rack-crosspiece',(x+a,y-.35,z+.64),(x+a,y+.35,z+.64),.055)
    for a in range(7):beam('reed-drying-slat',(x-.72,y-.3+a*.1,z+.68),(x+.72,y-.3+a*.1,z+.68),.03)
    cloth('drying-wool',x,y,z+.7,1.2,.53,'linen')


def house(kind):
    clear()
    names=['Small Building A.fbx','Medium Building A.fbx','Medium Building B.fbx','Large Building D.fbx','Small Building A.fbx','Medium Building A.fbx']
    h=[3.3,3.35,3.45,5.6,3.65,3.45][kind]
    wall='mud' if kind==2 else 'limestone' if kind>=4 else 'plaster'
    imported('anker',names[kind],(5.3,4.35,h),(0,-.4,0),math.pi/2,wall)
    # Courtyard, ladder and furnishings stay inside [-3.3,3.3] x [-2.8,3.4].
    for x in [-2.93,2.93]:
        box('courtyard-wall',(.25,1.58,.62),(x,2.45,.31),'limestone')
        box('courtyard-coping',(.31,1.66,.09),(x,2.45,.665),'cap')
    for x in [-1.98,1.98]:box('courtyard-front-return',(1.7,.24,.58),(x,3.15,.29),wall)
    # Civic bodies have an indented front corner: its ladder would appear
    # detached above the portico. Lean it against the solid rear wall instead.
    ladder=(1.85,-2.63,.02) if kind>=4 else (2.44,1.86,.02)
    imported('anker','Ladder B.fbx',(.7,.27,3.55),ladder,math.pi/2)
    if kind<4:
        imported('anker','Awning A.fbx' if kind%2==0 else 'Awning B.fbx',(2.65,1.28,2.5),(-1.1,2.46,0),math.pi/2)
        cloth('courtyard-shade-canopy',-1.1,2.46,2.58,2.7,1.3,'indigo' if kind%2==0 else 'linen')
        # Replace awning's beige panels with woven cloth, preserving its poles.
        for o in list(bpy.context.selected_objects):
            if o.type=='MESH':
                for slot in o.material_slots:
                    if slot.material in [M['plaster'],M['cap']]:slot.material=M['indigo' if kind%2==0 else 'linen']
    else:
        for x in [-2.24,-.78,.78,2.24]:column(x,2.4,2.58)
        box('portico-architrave',(5.3,.6,.25),(0,2.4,2.76),'limestone')
        box('portico-cornice',(5.55,.76,.12),(0,2.4,2.95),'cap')
        for x in [-2.3+i*.46 for i in range(11)]:box('carved-frieze',( .09,.035,.12),(x,2.716,2.76),'cap',.005)
        if kind==4:
            # A modest assembly hall, with a flat roof and plain civic stonework.
            box('assembly-hall-upper-band',(5.32,4.36,.16),(0,-.4,3.18),'cap')
            for x in [-1.95,1.95]:box('hall-pilaster',(.34,.19,2.85),(x,1.81,1.425),'limestone')
            box('public-hall-door-shadow',(1.26,.08,2.23),(0,1.84,1.12),'dark')
            imported('quaternius','Door_1_Flat.fbx',(1.12,.12,2.13),(0,1.91,.02))
    jar(-2.2,2.95);jar(-1.55,2.95)
    imported('quaternius','Prop_Crate.fbx',(.64,.62,.62),(1.93,2.7,0))
    # Roof activity distinguishes a working house from an unused sealed box.
    if kind in [0,2,4]:rack(-.95,-.45,h-.26)
    if kind in [1,3,5]:
        jar(-1.75,-1.4,h-.27);jar(-1.15,-1.4,h-.27)
        for i in range(8):beam('roof-reed-bundle',(-.8+i*.12,-1.5,h-.2),(-.8+i*.12,-.5,h-.2),.055,'linen')
    if kind==2:
        for i in range(5):box('mudbrick-repair',(.47,.035,.21),(-2.13+i*.5,1.79,.32+(i%2)*.23),'limestone',.012)
    export(['house-limestone','house-courtyard','house-mudbrick','house-workshop','house-assembly','house-colonnade'][kind])


def market():
    clear()
    for x in [-2,2]:
        for y in [-1.55,0,1.55]:column(x,y,2.72)
        box('market-long-architrave',(.5,3.76,.24),(x,0,2.9),'limestone')
    for y in [-1.55,1.55]:box('market-short-architrave',(4.5,.5,.24),(0,y,2.9),'limestone')
    for i in range(6):cloth('market-striped-shade',-1.88+i*.75,0,3.09,.76,3.75,'indigo' if i%2==0 else 'linen')
    box('market-planked-table',(2.9,.85,.15),(0,.2,.84),'wood')
    for x in [-1.2,1.2]:box('market-trestle',(.2,.68,.77),(x,.2,.385),'darkwood')
    for i in range(5):jar(-1.42+i*.66,-1.12)
    imported('quaternius','Prop_Crate.fbx',(.58,.56,.6),(1.55,.8,0))
    export('market-portico')


def boat():
    clear()
    sections=[(-2.05,.025,.63),(-1.65,.5,.53),(-1.05,.78,.49),(0,.9,.47),(1.05,.78,.49),(1.65,.5,.53),(2.05,.025,.63)]
    # Separate longitudinal strakes form a double-sided, open hull.
    for side in [-1,1]:
        for band in range(5):
            vs=[];fs=[]
            for y,width,top in sections:
                for t in [band/5,(band+1)/5]:vs.append((side*width*(.32+.68*t),y,-.2+(top+.2)*t))
            for i in range(len(sections)-1):a=i*2;fs.append((a,a+2,a+3,a+1) if side>0 else (a+1,a+3,a+2,a))
            mesh=bpy.data.meshes.new('hull-strake');mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new('mortise-and-tenon-hull-strake',mesh);bpy.context.collection.objects.link(o);apply(o,'wood' if band%2 else 'darkwood');uv(o)
            bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('plank-thickness','SOLIDIFY');mod.thickness=.038;bpy.ops.object.modifier_apply(modifier=mod.name)
        for i in range(len(sections)-1):
            a,b=sections[i],sections[i+1];beam('rounded-gunwale',(side*a[1],a[0],a[2]),(side*b[1],b[0],b[2]),.075,'darkwood')
    # A sealed planked sole sits above the rendered waterline. Its shaped edge
    # meets every hull section, including the narrow bow and stern, so the
    # ordinary lake surface cannot appear inside the open boat.
    for plank in range(5):
        vs=[];fs=[]
        for y,width,top in sections:
            floor_width=width*(.32+.68*(.075+.2)/(top+.2))
            for side in [plank/5,(plank+1)/5]:vs.append(((side*2-1)*floor_width,y,.075))
        for i in range(len(sections)-1):a=i*2;fs.append((a,a+1,a+3,a+2))
        mesh=bpy.data.meshes.new('shaped-interior-plank');mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new('dry-planked-interior',mesh);bpy.context.collection.objects.link(o);apply(o,'wood');uv(o)
        bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('floorboard-thickness','SOLIDIFY');mod.thickness=.035;bpy.ops.object.modifier_apply(modifier=mod.name)
    for y in [-1,0,1]:
        box('rowing-bench',(1.36,.28,.09),(0,y,.23),'wood')
        for x in [-.64,.64]:beam('hull-frame',(x*.35,y,-.13),(x,y,.36),.065,'darkwood')
    for x in [-.7,.7]:
        beam('resting-oar',(x,-1.65,.58),(x,1.22,.58),.045,'wood')
        box('shaped-oar-blade',(.17,.48,.038),(x,-1.65,.58),'wood',.04)
    lathe('coiled-fishing-rope',[(.21,0),(.24,.035),(.21,.07),(.24,.1),(.14,.1),(.14,0)],(.38,1.15,.3),'rope',16)
    for i in range(7):beam('folded-net-warp',(-.38+i*.095,.65,.33),(-.38+i*.095,1.22,.37),.012,'linen')
    for i in range(6):beam('folded-net-weft',(-.38,.65+i*.1,.33),(.19,.65+i*.1,.37),.012,'linen')
    export('fishing-boat')


def dock():
    clear()
    for i in range(8):box('weathered-landing-plank',(2.1,.29,.11),(0,-.95+i*.3,.1),'wood',.014)
    for x in [-.78,.78]:box('dock-bearing-beam',(.17,2.55,.18),(x,.1,-.035),'darkwood')
    for x in [-.97,.97]:
        for y in [-.9,.9]:
            # Tiberias's unchanged shore anchor is 1.08m above the water.
            # Full piles reach the bed there as well as at the lower landings.
            lathe('mooring-pile',[(.08,-1.6),(.07,.785)],(x,y,0),'darkwood',10)
            for z in [.29,.36]:lathe('pile-rope-binding',[(.095,z),(.095,z+.027)],(x,y,0),'rope',12)
    export('timber-dock')


def bridge():
    clear()
    # Canonical length one; runtime stretches longitudinally over the authored crossing.
    # One continuous deck prevents the former coplanar overlap with terrain y=.57.
    box('continuous-dry-stone-deck',(4.8,1,.23),(0,0,-.09),'limestone',.008)
    for x in [-2.54,2.54]:
        box('causeway-parapet',(.28,1,.48),(x,0,.19),'limestone',.01)
        box('causeway-coping',(.36,1,.075),(x,0,.465),'cap',.005)
    export('stone-bridge-span')


def arcade():
    clear()
    # Each four-metre bay has two arch spandrels and impost blocks. They are
    # outside the navigation corridor, with no collider or picking surface.
    for x in [-2.54,2.54]:
        for i in range(12):
            a=i/12*math.pi;b=(i+1)/12*math.pi
            ys=[-1.72*math.cos(a),-1.72*math.cos(b)]
            zs=[-.95+.76*math.sin(a),-.95+.76*math.sin(b)]
            verts=[(xx,y,z) for xx in [x-.14,x+.14] for y,z in [(ys[0],zs[0]),(ys[1],zs[1]),(ys[1],-.12),(ys[0],-.12)]]
            faces=[(0,1,2,3),(7,6,5,4),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)]
            mesh=bpy.data.meshes.new('arch-voussoir');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('arch-voussoir',mesh);bpy.context.collection.objects.link(o);apply(o,'limestone');uv(o)
        for y in [-1.86,1.86]:
            box('bridge-abutment',(.47,.28,1.32),(x,y,-.7),'limestone',.025)
            box('arch-impost',(.56,.38,.16),(x,y,-.9),'cap',.015)
    export('stone-bridge-arcade')


def export(name):
    # Join by material to keep draw calls small, while each building remains one fade group.
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in meshes:
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    groups={}
    for o in meshes:
        if len(o.data.materials)>1:
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH':groups.setdefault(o.data.materials[0].name if o.data.materials else 'empty',[]).append(o)
    for mat,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=name+'|'+mat
    points=[o.matrix_world@v.co for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices]
    bounds={'min':[min(v[i] for v in points) for i in range(3)],'max':[max(v[i] for v in points) for i in range(3)],'vertices':sum(len(o.data.vertices) for o in bpy.context.scene.objects if o.type=='MESH')}
    (OUT/(name+'.bounds.json')).write_text(json.dumps(bounds,indent=2)+'\n')
    # The host uses a right-handed Y-up scene. Blender exports -Y as +Z;
    # rotate our +Y-facing assemblies so doors and the long courtyard side
    # face game +Z. X bounds are symmetric about the preserved ground origin.
    for o in bpy.context.scene.objects:
        if o.type=='MESH':
            for v in o.data.vertices:v.co.x=-v.co.x;v.co.y=-v.co.y
            o.data.update()
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False)
    print('ARCHITECTURE',name,bounds,flush=True)

names=['house-limestone','house-courtyard','house-mudbrick','house-workshop','house-assembly','house-colonnade']
builders={'market-portico':market,'fishing-boat':boat,'timber-dock':dock,'stone-bridge-span':bridge,'stone-bridge-arcade':arcade}
parser=argparse.ArgumentParser();parser.add_argument('--asset',choices=names+list(builders))
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
for i,name in enumerate(names):
    if not args.asset or args.asset==name:house(i)
for name,build in builders.items():
    if not args.asset or args.asset==name:build()
