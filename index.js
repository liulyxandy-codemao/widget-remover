import axios from 'axios';
import prompts from 'prompts';
import ora from 'ora';

async function codemao_update_file(file, uuid, jwt) {
    let url = `https://open-service.codemao.cn/cdn/qi-niu/tokens/uploading?projectName=appcraft&filePaths=appcraft/WIDREMOVER_${uuid}.json&filePath=appcraft/WIDREMOVER_${uuid}.json&tokensCount=1&fileSign=p1&insertOnly=true&cdnName=qiniu`
    let header = {
        "Cookie": `authorization=${jwt}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.67"
    }
    let token_res = await axios.get(url, { headers: header })
    let token = token_res.data["tokens"][0]["token"]
    let filename = token_res.data["tokens"][0]['file_path']
    let upload_url = "https://upload.qiniup.com/"
    
    // 使用 FormData 自动处理边界参数
    let formData = new FormData();
    formData.append('token', token);
    formData.append('key', filename);
    formData.append('fname', 'test.json');
    formData.append('file', JSON.stringify(file));
    
    // 删除手动设置的 Content-Type，让浏览器自动设置
    delete header['Content-Type'];
    
    console.log(upload_url, formData, header)
    let upload_res = await axios.post(upload_url, formData, { headers: header })
    return upload_res.data["key"]
}

let answer = await prompts([
    {
        type: 'text',
        name: 'username',
        message: '请输入您的编程猫用户名'
    },
    {
        type: 'password',
        name: 'password',
        message: '验证您的编程猫密码'
    }
])
let spin = ora('登录中').start()
let udata = await axios.post("https://api.codemao.cn/tiger/v3/web/accounts/login", {
    pid: "7KeVbBdw",
    identity: answer.username,
    password: answer.password
}, { withCredentials: true })

if (udata.status != 200) {
    spin.fail("请求错误：" + String(udata.status))
    process.exit(0)
}
spin.succeed("登录成功")


let token = udata.data.auth.token

let workid = (await prompts([
    {
        type: 'text',
        name: 'work_id',
        message: '请输入您项目的WorkID'
    }
])).work_id
let work_data = await axios.get(`https://api-creation.codemao.cn/coconut/web/work/${workid}/content`, { withCredentials: true, headers: { 'Cookie': 'authorization=' + token } })
let work_json_data = (await axios.get(work_data.data.data.bcm_url, { withCredentials: true, headers: { 'Cookie': 'authorization=' + token } })).data
let widgets = [{
    type: 'multiselect',
    name: 'widget_name',
    message: '选择你要移除的自定义控件',
    choices: []
}]
work_json_data.unsafeExtensionWidgetList.forEach(element => {
    widgets[0].choices.push({
        title: element.type,
        value: element.type
    })
});
let widget_removes = await prompts(widgets)
work_json_data.unsafeExtensionWidgetList.forEach((element, x) => {
    if (widget_removes.widget_name.includes(element.type)) {
        work_json_data.unsafeExtensionWidgetList = work_json_data.unsafeExtensionWidgetList.filter(item => item.type != element.type)
    }
});

let work_pos = await codemao_update_file(work_json_data, Date.now(), token)
let load = ora('上传中').start()
let wdata = (await axios.get("https://creation.codemao.cn/" + work_pos)).data
let data = await axios.put("https://api-creation.codemao.cn/coconut/web/work", {
    archive_version: "0.1.0",
    bcm_url: "https://creation.codemao.cn/" + work_pos,
    id: workid,
    name: wdata["title"],
    preview_url: work_json_data.screens[work_json_data.screenIds[0]].snapshot,
    save_type: 1
}, { withCredentials: true, headers: { 'Cookie': 'authorization=' + token } })
if (data.status == 200) {
    load.succeed("移除成功")
} else {
    load.fail('移除失败')
}