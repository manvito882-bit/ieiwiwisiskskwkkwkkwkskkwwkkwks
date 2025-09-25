import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Image as ImageIcon, User, Shield, Palette } from 'lucide-react';

const Index = () => {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold bg-gradient-to-r from-lavender to-lavender-dark bg-clip-text text-transparent">
          Добро пожаловать в Медиа Платформу
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Современная платформа для обмена медиа-контентом с уникальным лавандово-белым дизайном
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Card className="p-6 border-lavender-light hover:shadow-lg transition-shadow group cursor-pointer" 
              onClick={() => window.location.href = '/videos'}>
          <CardContent className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-lavender-light rounded-full flex items-center justify-center group-hover:bg-lavender transition-colors">
              <Play className="w-8 h-8 text-lavender group-hover:text-white" />
            </div>
            <h2 className="text-2xl font-semibold">Видео-контент</h2>
            <p className="text-muted-foreground">
              Загружайте и просматривайте движущиеся изображения. 
              Поделитесь своими видео с сообществом.
            </p>
            <Button variant="outline" className="border-lavender text-lavender hover:bg-lavender hover:text-white">
              Перейти к видео
            </Button>
          </CardContent>
        </Card>

        <Card className="p-6 border-lavender-light hover:shadow-lg transition-shadow group cursor-pointer"
              onClick={() => window.location.href = '/photos'}>
          <CardContent className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-lavender-light rounded-full flex items-center justify-center group-hover:bg-lavender transition-colors">
              <ImageIcon className="w-8 h-8 text-lavender group-hover:text-white" />
            </div>
            <h2 className="text-2xl font-semibold">Фото-контент</h2>
            <p className="text-muted-foreground">
              Загружайте и просматривайте статичные изображения. 
              Делитесь своими фотографиями с другими пользователями.
            </p>
            <Button variant="outline" className="border-lavender text-lavender hover:bg-lavender hover:text-white">
              Перейти к фото
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-3xl mx-auto text-center">
        <h3 className="text-lg font-medium mb-4">Особенности платформы</h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto bg-lavender-light rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-lavender" />
            </div>
            <p><strong>Простая регистрация</strong><br />Только username и пароль</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto bg-lavender-light rounded-full flex items-center justify-center">
              <Shield className="w-4 h-4 text-lavender" />
            </div>
            <p><strong>Безопасность</strong><br />Контент только для взрослых (18+)</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 mx-auto bg-lavender-light rounded-full flex items-center justify-center">
              <Palette className="w-4 h-4 text-lavender" />
            </div>
            <p><strong>Уникальный дизайн</strong><br />Лавандово-белая цветовая схема</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
