# Makefile - 一键初始化开发环境

.PHONY: help install setup dev clean

# 默认目标
help:
	@echo "可用命令:"
	@echo "  make install    - 安装所有依赖"
	@echo "  make setup      - 完整初始化（安装依赖 + 生成类型）"
	@echo "  make dev        - 启动开发服务器"
	@echo "  make build      - 构建所有应用"
	@echo "  make clean      - 清理所有缓存和依赖"
	@echo "  make reset      - 完全重置（清理 + 重新安装）"

# 安装依赖
install:
	@echo "📦 安装依赖..."
	pnpm install
	pnpm add -w -D @types/node typescript tsx
	pnpm add -w dotenv-cli

# 生成 Prisma 客户端
prisma:
	@echo "🗄️  生成 Prisma 客户端..."
	cd packages/database && pnpm prisma generate

# 设置环境变量
env:
	@echo "📝 设置环境变量..."
	@if [ ! -f .env ]; then \
		cp .env.example .env || echo "⚠️  .env.example 不存在，跳过"; \
	fi

# 完整初始化
setup: install prisma env
	@echo "✅ 初始化完成！"
	@echo "运行 'make dev' 启动开发服务器"

# 启动开发
dev:
	@echo "🚀 启动开发服务器..."
	pnpm dev

# 构建
build:
	@echo "🏗️  构建所有应用..."
	pnpm build

# 清理
clean:
	@echo "🧹 清理缓存..."
	rm -rf node_modules .turbo
	rm -rf apps/*/.nuxt apps/*/dist
	rm -rf packages/*/dist packages/*/.turbo
	find . -name ".tsbuildinfo" -delete
	find . -name "*.log" -delete

# 完全重置
reset: clean
	@echo "🔄 完全重置..."
	pnpm install
	make setup
