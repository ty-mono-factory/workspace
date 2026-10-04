# ¶ÀÁ¢ÇåÀíÈ«²¿¹¹½¨²úÎï
bash scripts/build/build.sh --clean

# Ö»ÇåÀíÖ¸¶¨ app
bash scripts/build/build.sh --clean --project access-web

# ÇåÀí¡¢±àÒë²¢´ò°ü
bash scripts/build/build.sh --project access-web

# ¹¹½¨¾µÏñ
docker build \
  --build-arg PROJECT=access-web \
  -f scripts/build/Dockerfile \
  -t access-web:latest .

