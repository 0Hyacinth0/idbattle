// 简化版MD5哈希函数
function simpleMD5(str) {
    // 这里是简化版的MD5实现，仅用于生成伪随机数
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    // 转换为16进制字符串
    return Math.abs(hash).toString(16).padStart(8, '0');
}

export default simpleMD5;