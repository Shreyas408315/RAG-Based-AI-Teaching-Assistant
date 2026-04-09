import whisper
import json

model = whisper.load_model("large-v2")

result = model.transcribe(
    "audios/sample.mp3",
    language="en",
    task="translate",
    fp16=False,
    word_timestamps = False
)
print(result["segments"])
chunks = []
for segment in result["segments"]:
    chunks.append({"start": segment["start"], "end": segment["end"], "text": segment["text"]})

print(chunks)

with open("output.json", "w") as f:
    json.dump(chunks, f)