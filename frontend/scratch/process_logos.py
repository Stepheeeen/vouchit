import os
import math
from PIL import Image, ImageOps

# Source paths
public_dir = '/Users/admin/Github/vouchit/frontend/public'
app_dir = '/Users/admin/Github/vouchit/frontend/src/app'

path_full = os.path.join(public_dir, 'Logo- 2.png')
path_mark = os.path.join(public_dir, 'Logo (1).png')

def process_image(src_path, is_square=False, padding=20):
    img = Image.open(src_path).convert('RGB')
    width, height = img.size
    
    # Background color is at pixel (0,0)
    bg_color = img.getpixel((0, 0))
    print(f"Processing {os.path.basename(src_path)}: size={width}x{height}, bg_color={bg_color}")
    
    # Calculate transparency using distance-based alpha keying
    # Foreground is white (255, 255, 255)
    # B = bg_color, W = (255, 255, 255)
    bw_dist = math.sqrt(sum((255 - c) ** 2 for c in bg_color))
    
    pixels = img.load()
    
    # Create two versions:
    # 1. White logo on transparent background
    # 2. Teal logo on transparent background
    white_trans = Image.new('RGBA', (width, height))
    teal_trans = Image.new('RGBA', (width, height))
    
    wt_data = []
    tt_data = []
    
    for y in range(height):
        for x in range(width):
            c = pixels[x, y]
            # distance from bg
            dist_bg = math.sqrt(sum((c[i] - bg_color[i]) ** 2 for i in range(3)))
            # distance from white
            dist_w = math.sqrt(sum((255 - c[i]) ** 2 for i in range(3)))
            
            # calculate alpha: project C onto the line segment B-W
            # alpha = ||C-B|| / ||W-B||. We clamp it between 0 and 1.
            alpha = 0.0 if bw_dist == 0 else dist_bg / bw_dist
            alpha = max(0.0, min(1.0, alpha))
            
            # To ensure solid white parts are completely opaque and pure background is completely transparent:
            if dist_bg < 5:
                alpha = 0.0
            elif dist_w < 5:
                alpha = 1.0
                
            a_val = int(round(alpha * 255))
            
            # White transparent version
            wt_data.append((255, 255, 255, a_val))
            # Teal transparent version
            tt_data.append((bg_color[0], bg_color[1], bg_color[2], a_val))
            
    white_trans.putdata(wt_data)
    teal_trans.putdata(tt_data)
    
    # Get bounding box of non-transparent pixels
    bbox = white_trans.getbbox()
    if not bbox:
        bbox = (0, 0, width, height)
        
    # Crop to bounding box plus padding
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2
    
    w_box = x1 - x0
    h_box = y1 - y0
    
    if is_square:
        # For mark, we want a square bounding box
        side = max(w_box, h_box)
        x0 = max(0, cx - side // 2 - padding)
        y0 = max(0, cy - side // 2 - padding)
        x1 = min(width, cx + side // 2 + padding)
        y1 = min(height, cy + side // 2 + padding)
    else:
        # For full logo, standard rectangle
        x0 = max(0, x0 - padding)
        y0 = max(0, y0 - padding)
        x1 = min(width, x1 + padding)
        y1 = min(height, y1 + padding)
        
    crop_wt = white_trans.crop((x0, y0, x1, y1))
    crop_tt = teal_trans.crop((x0, y0, x1, y1))
    
    # Create the original colored background version but cropped
    original_bg = Image.new('RGB', (x1 - x0, y1 - y0), bg_color)
    # Paste the white logo on top
    original_bg.paste(crop_wt, (0, 0), crop_wt)
    
    return crop_wt, crop_tt, original_bg

# Process both logos
wt_full, tt_full, bg_full = process_image(path_full, is_square=False, padding=24)
wt_mark, tt_mark, bg_mark = process_image(path_mark, is_square=True, padding=32)

# Save standard full sizes in public dir
# Transparent background versions
wt_full.save(os.path.join(public_dir, 'logo-full-transparent.png'))
tt_full.save(os.path.join(public_dir, 'logo-full-colored.png'))
bg_full.save(os.path.join(public_dir, 'logo-full.png'))

# Logo mark versions
wt_mark.save(os.path.join(public_dir, 'logo-mark-transparent.png'))
tt_mark.save(os.path.join(public_dir, 'logo-mark-colored.png'))
bg_mark.save(os.path.join(public_dir, 'logo-mark.png'))

# Generate favicons & touch icons
# Next.js favicon (ICO multi-resolution in src/app)
ico_sizes = [(16, 16), (32, 32), (48, 48)]
ico_imgs = [wt_mark.resize(size, Image.Resampling.LANCZOS) for size in ico_sizes]
ico_imgs[0].save(
    os.path.join(app_dir, 'favicon.ico'),
    format='ICO',
    sizes=ico_sizes,
    append_images=ico_imgs[1:]
)
print("Saved favicon.ico in src/app")

# Save PNG favicons in public
wt_mark.resize((16, 16), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'favicon-16x16.png'))
wt_mark.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'favicon-32x32.png'))

# Touch Icons (Usually opaque with theme bg color)
bg_mark.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'apple-touch-icon.png'))
bg_mark.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'android-chrome-192x192.png'))
bg_mark.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'android-chrome-512x512.png'))

# Clean up old raw files to avoid clutter
try:
    os.remove(path_full)
    os.remove(path_mark)
    print("Cleaned up raw files.")
except Exception as e:
    print(f"Error removing raw files: {e}")

print("Logo generation complete!")
