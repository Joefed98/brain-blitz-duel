import sys

def fix_cross():
    with open('src/lib/arcade/cross.renderer.ts', 'r') as f:
        lines = f.readlines()
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        new_lines.append(line)
        if 'ctx.stroke();' in line and i < len(lines) - 3:
            # If we see the outline we added, skip it if it's duplicated
            if 'rgba(210, 238, 240, 0.8)' in lines[i+1]:
                new_lines.append(lines[i+1])
                new_lines.append(lines[i+2])
                new_lines.append(lines[i+3])
                i += 4
                # Skip any subsequent duplicates
                while i < len(lines) and 'rgba(210, 238, 240, 0.8)' in lines[i]:
                    i += 3 
                continue
        i += 1
    with open('src/lib/arcade/cross.renderer.ts', 'w') as f:
        f.writelines(new_lines)

# Actually, I'll just overwrite the files with the correct desired content 
# since I know what they should look like.
