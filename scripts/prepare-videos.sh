#!/usr/bin/env bash
# Makes video files browser-friendly before uploading them to Telegram,
# without re-encoding the picture whenever possible (no quality loss).
#
#   bash scripts/prepare-videos.sh ~/Downloads/Brickleberry
#
# Writes fixed copies to <folder>/ready/ (originals are never touched):
#   - HEVC video gets the "hvc1" tag Safari/iPhone need (H.264 is left as is)
#   - audio browsers can't play (AC-3, DTS, …) is converted to AAC
#   - the file index moves to the front so playback starts quickly
#   - MKV/MOV/AVI become MP4
# Requires ffmpeg: brew install ffmpeg

set -eo pipefail

dir="${1:-.}"
out="$dir/ready"
command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null || {
  echo "ffmpeg is not installed. Run: brew install ffmpeg"
  exit 1
}
[ -d "$dir" ] || { echo "Folder not found: $dir"; exit 1; }
mkdir -p "$out"

shopt -s nullglob nocaseglob
files=("$dir"/*.mp4 "$dir"/*.mkv "$dir"/*.mov "$dir"/*.m4v "$dir"/*.avi "$dir"/*.webm)
[ ${#files[@]} -gt 0 ] || { echo "No video files in $dir"; exit 1; }

probe() { ffprobe -v error -select_streams "$1" -show_entries stream=codec_name -of csv=p=0 "$2" | head -1; }

for f in "${files[@]}"; do
  name=$(basename "${f%.*}")
  target="$out/$name.mp4"
  if [ -e "$target" ]; then echo "• $name — already done, skipping"; continue; fi

  video=$(probe v:0 "$f")
  audio=$(probe a:0 "$f")
  args=(-map 0:v:0)
  case "$video" in
    hevc) args+=(-c:v copy -tag:v hvc1); vnote="HEVC kept (tagged hvc1)" ;;
    h264) args+=(-c:v copy); vnote="H.264 kept" ;;
    *) args+=(-c:v libx264 -crf 20 -preset medium); vnote="$video re-encoded to H.264 (slow)" ;;
  esac
  if [ -n "$audio" ]; then
    args+=(-map 0:a:0)
    if [ "$audio" = aac ]; then args+=(-c:a copy); anote="AAC kept"; else args+=(-c:a aac -b:a 192k); anote="$audio → AAC"; fi
  else
    anote="no audio"
  fi

  echo "• $name — $vnote, $anote"
  ffmpeg -hide_banner -loglevel error -i "$f" "${args[@]}" -movflags +faststart "$target"
done

echo "Done. Upload the files in: $out"
