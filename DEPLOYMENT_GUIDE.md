# Be My Eyes Helper - 服务器部署指南

## 快速部署（推荐）

### 方法 1：一键部署脚本

在你的服务器上运行以下命令：

```bash
# SSH 登录到服务器
ssh root@150.107.201.220

# 下载并运行部署脚本
curl -fsSL https://raw.githubusercontent.com/Yuanyiis/element-call/claude/review-project-docs-01MccRDcsfwy7FzpBSBzeBQ2/deploy.sh | bash
```

或者手动步骤：

```bash
# 1. SSH 登录
ssh root@150.107.201.220
# 输入密码: 08980898

# 2. 下载部署脚本
wget https://raw.githubusercontent.com/Yuanyiis/element-call/claude/review-project-docs-01MccRDcsfwy7FzpBSBzeBQ2/deploy.sh

# 3. 赋予执行权限
chmod +x deploy.sh

# 4. 运行部署脚本
./deploy.sh
```

### 方法 2：手动部署（如果方法1不可用）

```bash
# 1. SSH 登录到服务器
ssh root@150.107.201.220

# 2. 更新系统
apt-get update
apt-get upgrade -y

# 3. 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
corepack enable

# 4. 安装 Nginx 和其他依赖
apt-get install -y nginx git build-essential

# 5. 克隆项目
cd /opt
git clone -b claude/review-project-docs-01MccRDcsfwy7FzpBSBzeBQ2 https://github.com/Yuanyiis/element-call.git bme-helper
cd bme-helper

# 6. 安装依赖
yarn install

# 7. 创建配置文件
cat > public/config.json << 'EOF'
{
  "default_server_config": {
    "m.homeserver": {
      "base_url": "https://matrix.org",
      "server_name": "matrix.org"
    }
  }
}
EOF

# 8. 构建项目
NODE_OPTIONS=--max-old-space-size=4096 yarn build:full:production

# 9. 配置 Nginx
cat > /etc/nginx/sites-available/bme-helper << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name 150.107.201.220;

    root /opt/bme-helper/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /config.json {
        add_header Cache-Control "no-cache";
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# 10. 启用站点
ln -sf /etc/nginx/sites-available/bme-helper /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 11. 测试并重启 Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

# 12. 配置防火墙
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "部署完成！访问 http://150.107.201.220"
```

## 验证部署

部署完成后，执行以下检查：

```bash
# 检查 Nginx 状态
systemctl status nginx

# 检查端口监听
netstat -tlnp | grep :80

# 查看 Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 测试网站
curl -I http://150.107.201.220
```

## 访问应用

浏览器打开: **http://150.107.201.220**

你应该看到 "Be My Eyes Helper" 的角色选择页面。

## 测试流程

### 测试 1：基础功能
1. 打开 http://150.107.201.220
2. 应该看到角色选择页面
3. 点击"我是志愿者"或"我需要帮助"

### 测试 2：志愿者流程
1. 选择"我是志愿者"
2. 可能需要登录（使用 matrix.org 账号或匿名）
3. 点击"开始等待请求"
4. 应该进入等待状态

### 测试 3：视障者流程
1. 打开另一个浏览器窗口（隐私模式）
2. 选择"我需要帮助"
3. 允许摄像头权限
4. 点击"寻找志愿者"
5. 应该显示搜索动画

### 测试 4：完整匹配流程
需要两个用户同时在线：
1. 用户A: 志愿者等待中
2. 用户B: 点击寻找志愿者
3. 应该自动匹配并进入视频通话房间

## 故障排查

### 问题 1: 无法访问网站

```bash
# 检查 Nginx 是否运行
systemctl status nginx

# 检查防火墙
ufw status

# 查看错误日志
tail -100 /var/log/nginx/error.log
```

### 问题 2: 构建失败

```bash
# 检查 Node.js 版本（需要 >=20）
node -v

# 清理并重新安装
cd /opt/bme-helper
rm -rf node_modules
yarn install
yarn build:full:production
```

### 问题 3: 500 错误

```bash
# 检查文件权限
ls -la /opt/bme-helper/dist

# 修复权限
chmod -R 755 /opt/bme-helper/dist
```

### 问题 4: Nginx 配置错误

```bash
# 测试配置
nginx -t

# 查看配置
cat /etc/nginx/sites-available/bme-helper

# 重新加载
nginx -s reload
```

## 性能优化（可选）

### 启用 HTTP/2
```bash
# 修改 Nginx 配置
sed -i 's/listen 443 ssl;/listen 443 ssl http2;/' /etc/nginx/sites-available/bme-helper
nginx -s reload
```

### 启用缓存
```bash
# 在 Nginx 配置中添加
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## SSL 证书（推荐）

如果你有域名，可以配置 SSL：

```bash
# 安装 Certbot
apt-get install -y certbot python3-certbot-nginx

# 获取证书（替换为你的域名）
certbot --nginx -d yourdomain.com

# 自动续期
certbot renew --dry-run
```

## 更新应用

```bash
cd /opt/bme-helper
git pull origin claude/review-project-docs-01MccRDcsfwy7FzpBSBzeBQ2
yarn install
yarn build:full:production
nginx -s reload
```

## 监控和日志

```bash
# 实时查看访问日志
tail -f /var/log/nginx/access.log

# 实时查看错误日志
tail -f /var/log/nginx/error.log

# 查看系统资源
htop

# 检查磁盘空间
df -h
```

## 备份

```bash
# 备份配置
tar -czf bme-helper-backup-$(date +%Y%m%d).tar.gz \
    /opt/bme-helper/public/config.json \
    /etc/nginx/sites-available/bme-helper

# 备份到其他位置
cp bme-helper-backup-*.tar.gz /root/backups/
```

## 卸载

```bash
# 停止 Nginx
systemctl stop nginx

# 删除应用
rm -rf /opt/bme-helper

# 删除 Nginx 配置
rm /etc/nginx/sites-enabled/bme-helper
rm /etc/nginx/sites-available/bme-helper

# 恢复默认站点（可选）
ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/

# 重启 Nginx
systemctl start nginx
```

## 支持

如有问题，请检查：
1. BME_MVP_README.md - MVP 文档
2. README.md - Element Call 原始文档
3. Nginx 错误日志
4. 浏览器控制台错误

## 下一步

部署成功后，你可以：
1. ✅ 测试角色选择功能
2. ✅ 测试志愿者注册和等待
3. ✅ 测试视障者寻求帮助
4. ✅ 测试完整匹配流程
5. ✅ 测试摄像头控制（移动设备）
6. ⚙️ 配置自己的 Matrix 服务器（可选）
7. 🔒 添加 SSL 证书（推荐）

---

**部署完成后，请访问:**
- **主页**: http://150.107.201.220
- **文档**: http://150.107.201.220/BME_MVP_README.md (如果部署了)

**测试账号建议:**
- 使用 matrix.org 的测试账号
- 或使用匿名模式（无需注册）

祝测试顺利！🎉
