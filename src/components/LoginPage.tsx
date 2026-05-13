import { useState } from 'react';
import { Form, Input, Button, message as antMessage } from 'antd';
import { login } from '../services/auth';
import { initTheme } from '../services/theme';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  useState(() => {
    initTheme();
  });

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      antMessage.success('登录成功');
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败';
      antMessage.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <div className="logo-icon">C</div>
          <h1 className="login-title">Claude</h1>
          <p className="login-subtitle">登录以继续对话</p>
        </div>

        <Form
          layout="vertical"
          onFinish={handleSubmit}
          className="login-form"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱' },
            ]}
          >
            <Input placeholder="邮箱" className="login-input" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" className="login-input" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="login-btn"
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1a1a18;
        }

        .login-container {
          width: 100%;
          max-width: 320px;
          padding: 32px 24px;
        }

        .login-logo {
          text-align: center;
          margin-bottom: 28px;
        }

        .logo-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #d97757, #a84d2e);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
          font-size: 24px;
          font-weight: 600;
          color: #fff;
        }

        .login-title {
          font-size: 22px;
          font-weight: 600;
          color: #f5f4ee;
          margin: 0 0 6px;
        }

        .login-subtitle {
          font-size: 13px;
          color: #8a8780;
          margin: 0;
        }

        .login-form {
          background: #2d2c2a;
          border: 1px solid #3a3836;
          border-radius: 12px;
          padding: 20px;
        }

        .login-input {
          background: #30302e !important;
          border-color: #3a3836 !important;
          color: #f5f4ee !important;
          border-radius: 8px !important;
          height: 42px !important;
          padding: 8px 12px !important;
          font-size: 14px !important;
        }

        .login-input .ant-input {
          background: transparent !important;
          color: #f5f4ee !important;
          height: 26px !important;
          font-size: 14px !important;
        }

        .login-input .ant-input::placeholder {
          color: #8a8780 !important;
        }

        .login-input .ant-input:focus {
          box-shadow: none !important;
        }

        .login-input:focus,
        .login-input.ant-input-affix-wrapper-focused {
          border-color: #d97757 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 87, 0.15) !important;
        }

        .login-input .ant-input-password-icon {
          color: #8a8780 !important;
        }

        .login-input .ant-input-password-icon:hover {
          color: #f5f4ee !important;
        }

        .login-btn {
          height: 42px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          border-radius: 8px !important;
          background: #d97757 !important;
          border: none !important;
        }

        .login-btn:hover {
          background: #c96a4a !important;
        }

        .login-form .ant-form-item-label > label {
          color: #b8b6b0 !important;
          font-size: 13px !important;
        }
      `}</style>
    </div>
  );
}