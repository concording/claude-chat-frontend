import { useState } from 'react';
import { Modal, Form, Input, Button, message as antMessage } from 'antd';
import { login } from '../services/auth';

interface LoginModalProps {
  open: boolean;
  onLoginSuccess: () => void;
  onCancel?: () => void;
}

export default function LoginModal({ open, onLoginSuccess, onCancel }: LoginModalProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      antMessage.success('Login successful');
      onLoginSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      antMessage.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      footer={null}
      title="登录"
      width={400}
      centered
      closable={false}
      maskClosable={false}
      keyboard={false}
    >
      <Form
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 24 }}
      >
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Please enter your email' },
            { type: 'email', message: 'Please enter a valid email' },
          ]}
        >
          <Input placeholder="admin@sub2api.local" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Please enter your password' }]}
        >
          <Input.Password placeholder="Password" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Login
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
