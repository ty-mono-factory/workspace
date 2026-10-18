rm -rf /tmp/aaaa/bbbb
mkdir -p /tmp/aaaa/bbbb
tar xzf /workspace/monorepo/artifacts/access-web_db.tar.gz -C /tmp/aaaa/bbbb

ls -la /tmp/aaaa/bbbb
# 确认只有 .js，没有 .ts

docker run --rm \
  -v /tmp/aaaa/bbbb:/migration \
  -e DATABASE_URL="file:/tmp/test-deploy.db" \
  registry.example.com/mini-factory/mini-factory-dbmigrator:1.0.0

docker load -i mini-factory-dbmigrator.tar
