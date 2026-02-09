```yaml
subject_name: "Album"
id: "album"
sdf_version: "1.0"
icon: "disc"

validate_subject: true
validation_threshold: 0.8

naming:
    note: "{{artist}} - {{album}} ({{year}})"
    photo: "{{artist}}_{{album}}_{{year}}"

properties:
    - key: "artist"
      instruction: "Artist or Band name. If the artist has a first and last name, list the name as first name, last name."
    - key: "album"
      instruction: "Album title"
    - key: "year"
      instruction: "Release year (YYYY)"
    - key: "label"
      instruction: "Record Label"
    - key: "genre"
      instruction: "Which of the following genres are appropriate for this album: Rock, Classical, Jazz, Chill, Electronic/EDM, Pop, Country, Folk and Traditional. More than one of those might apply."
      type: sequence
    - key: "playing_speed"
      instruction: "Is this vinyl record played at 33 and a half or 45 speed?"
    - key: "is_digital"
      default: false
      touch_me_not: true
    - key: "is_reviewed"
      default: false
    - key: "needs_washing"
      default: false
      touch_me_not: true
    - key: "worth_playing"
      default: true
      touch_me_not: true
##    - key: "original_photo"
##      default: "{{original_image}}"
    - key: sdf_version
      default: "{{sdf_version}}"

sections:
    - heading: "My Notes"
      instruction: "{{my_notes}}"
    - heading: "Track List"
      instruction: "Ordered list of tracks on the album. Please be sure to check MusicBrainz.org to verify the track list. Make sure each track is listed on a separate line."
    - heading: "Reviews"
      instruction: "Short summary of any reviews you can find for the album, most especially from Pitchfork and AllMusic."

lead_prompt: "You are a music historian and critic. Analyze the provided album cover image and infer structured metadata. Search for additional information online if needed, especially for the track list and reviews."

trailing_prompt: "If a field is unknown, use an empty string. If you do not have reasonable confidence about idenfying the Album, call it 'Unidentified' and leave all property values blank. Return ONLY valid JSON."
```
