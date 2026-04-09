import os
import subprocess
import re

os.makedirs("audios", exist_ok=True)

files = os.listdir("videos")

for file in files:
    if not file.endswith(".mp4"):
        continue

    base_name = file.replace(".mp4", "")
    clean_name = re.sub(r"\(.*?\)", "", base_name).strip()

    parts = clean_name.split(" ", 1)
    tutorial_number = parts[0]
    title = parts[1] if len(parts) > 1 else ""

    output_name = f"{tutorial_number}_{title}.mp3"

    print("Converting:", output_name)

    subprocess.run([
        "ffmpeg",
        "-i", f"videos/{file}",
        f"audios/{output_name}"
    ])