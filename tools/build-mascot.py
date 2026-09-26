"""
สร้างรูป mascot สำหรับเว็บ (assets/img/*.webp) จากไฟล์ต้นฉบับ PNG ใน assets/img/src/

รูปต้นฉบับเป็นหุ่นเต็มตัว แต่หน้าเว็บแสดงแค่ในวงกลมเล็ก (ปุ่มลอย 56px, header 32px, หน้าประกาศ 64px)
ถ้าย่อทั้งตัวลงไปหน้าจะเหลือไม่ถึง 20px — สคริปต์นี้จึงครอปให้เหลือครึ่งตัวบน แล้วบันทึกเป็น WebP ขนาดเล็ก

ครอปทุกท่าโดยจัดให้ "หน้าจอ" (visor สีดำ) ของหุ่นอยู่ตำแหน่งเดียวกันเสมอ ตอนสลับท่าบนหน้าเว็บหัวหุ่นจึง
ไม่กระโดดไปมา ส่วนขนาดกรอบคิดเป็นสัดส่วนของความกว้างรูป (รูปต้นฉบับทุกไฟล์วาดหุ่นขนาดเท่ากันเมื่อเทียบกับกรอบรูป
ถึงแต่ละไฟล์จะมีความละเอียดต่างกัน เช่น 320px กับ 816px)

ใช้งาน (ต้องมี Pillow + numpy):  python tools/build-mascot.py
ชื่อไฟล์ผลลัพธ์ = ชื่อไฟล์ต้นฉบับเปลี่ยนนามสกุลเป็น .webp (เช่น src/01_idle.png -> 01_idle.webp)
ดูชื่อไฟล์ของแต่ละท่าได้ที่ get_mascot_poses() ใน includes/class-widget.php
"""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / 'assets' / 'img' / 'src'
OUT_DIR = ROOT / 'assets' / 'img'

OUT_SIZE = 192  # ~3 เท่าของปุ่มลอย 56px — ยังคมบนจอ retina
QUALITY = 86

CROP_SIDE = 0.59  # ด้านของกรอบสี่เหลี่ยมจัตุรัส เทียบกับความกว้างรูปต้นฉบับ (~หัว + ไหล่ + มือ)
CROP_ABOVE_VISOR = 0.18  # ระยะเหนือขอบบน visor ที่เผื่อไว้ให้เสาอากาศ เทียบกับความกว้างรูป


def find_visor( rgba ):
	"""คืน (top, center_x) ของ visor = ก้อนพิกเซลสีเข้มที่ใหญ่ที่สุดบริเวณกลางค่อนบนของรูป"""
	h, w = rgba.shape[:2]
	dark = ( rgba[:, :, 3] > 200 ) & ( rgba[:, :, :3].max( axis=2 ) < 70 )
	y0, y1, x0, x1 = int( h * 0.15 ), int( h * 0.45 ), int( w * 0.35 ), int( w * 0.65 )
	seeds = np.argwhere( dark[y0:y1, x0:x1] ) + [y0, x0]

	seen = np.zeros_like( dark )
	best = None
	for sy, sx in seeds:
		if seen[sy, sx]:
			continue
		seen[sy, sx] = True
		queue = deque( [( sy, sx )] )
		pts = []
		while queue:
			y, x = queue.popleft()
			pts.append( ( y, x ) )
			for ny, nx in ( ( y + 1, x ), ( y - 1, x ), ( y, x + 1 ), ( y, x - 1 ) ):
				if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and not seen[ny, nx]:
					seen[ny, nx] = True
					queue.append( ( ny, nx ) )
		if best is None or len( pts ) > len( best ):
			best = pts

	if not best:
		return None
	pts = np.array( best )
	return pts[:, 0].min(), ( pts[:, 1].min() + pts[:, 1].max() ) / 2


def build( src ):
	im = Image.open( src ).convert( 'RGBA' )
	w = im.width
	visor = find_visor( np.asarray( im ) )
	if visor is None:
		# หา visor ไม่เจอ (ภาพไม่ใช่หุ่นตัวเดิม) — ครอปครึ่งบนตรงกลางแทน ควรเปิดดูผลลัพธ์ด้วยตา
		print( f'  ! {src.name}: ไม่พบ visor ใช้กรอบกลางภาพแทน' )
		top, cx = w * 0.02, w / 2
	else:
		top, cx = visor
		top -= w * CROP_ABOVE_VISOR

	side = w * CROP_SIDE
	left = cx - side / 2
	# Pillow เติมพื้นที่ที่เลยขอบรูปด้วยพิกเซลโปร่งใสให้เอง ไม่ต้อง clamp กรอบ
	box = tuple( round( v ) for v in ( left, top, left + side, top + side ) )
	out = im.crop( box ).resize( ( OUT_SIZE, OUT_SIZE ), Image.LANCZOS )

	dest = OUT_DIR / ( src.stem + '.webp' )
	out.save( dest, 'WEBP', quality=QUALITY, method=6 )
	print( f'  {src.name} -> {dest.name}  crop={box}  {dest.stat().st_size / 1024:.1f} KB' )


def main():
	sources = sorted( SRC_DIR.glob( '*.png' ) )
	if not sources:
		raise SystemExit( f'ไม่พบไฟล์ PNG ใน {SRC_DIR}' )
	print( f'สร้าง {len( sources )} ไฟล์ -> {OUT_DIR}' )
	for src in sources:
		build( src )


if __name__ == '__main__':
	main()
