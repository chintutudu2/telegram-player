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
#   - text subtitles inside the file become <name>.<lang>.vtt next to it, and
#     subtitle files beside the original (<name>.srt, <name>.en.srt…) are
#     copied over. Post each one as a reply to its video in the channel.
#     (Picture-based subtitles — PGS/VobSub from Blu-ray/DVD — can't be converted.)
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

  # Embedded text subtitles → WebVTT, one file per track: "<index>,<codec>,<lang>".
  while IFS=, read -r index codec lang; do
    [ -n "$index" ] || continue
    case "$codec" in
      subrip|ass|ssa|webvtt|mov_text|text) ;;
      *) echo "    subtitle track $index ($codec) is picture-based — skipped"; continue ;;
    esac
    sub="$out/$name.${lang:-und}.vtt"
    n=2
    while [ -e "$sub" ]; do sub="$out/$name.${lang:-und}-$n.vtt"; n=$((n + 1)); done
    if ffmpeg -nostdin -hide_banner -loglevel error -i "$f" -map "0:$index" -c:s webvtt "$sub"; then
      echo "    subtitles: $(basename "$sub")"
    else
      rm -f "$sub"
      echo "    subtitle track $index couldn't be converted — skipped"
    fi
  done < <(ffprobe -v error -select_streams s -show_entries stream=index,codec_name:stream_tags=language -of csv=p=0 "$f")

  # Subtitle files sitting next to the original.
  for s in "$dir/$name".srt "$dir/$name".*.srt "$dir/$name".vtt "$dir/$name".*.vtt; do
    [ -e "$s" ] || continue # the non-wildcard names stay literal when missing
    cp "$s" "$out/" && echo "    subtitles: $(basename "$s")"
  done
done

echo "Done. Upload the files in: $out"
[ -n "$FROM_UPLOAD_SCRIPT" ] || echo "Post each .vtt/.srt as a reply to its video post (caption: the language, e.g. English)."
