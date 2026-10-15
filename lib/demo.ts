import type { Store } from "./types";
export const initialStore: Store = {
  version: 1,
  shopName: "Техно Стор",
  city: "Москва",
  ai: {
    enabled: false,
    style: "friendly",
    instructions:
      "Отвечай вежливо и по существу. Не обещай скидки и доставку без подтверждения продавца.",
  },
  products: [
    {
      id: "p1",
      name: "iPhone 15 Pro, 256 ГБ",
      description:
        "Титановый корпус, цвет Natural Titanium. Отличное состояние, аккумулятор 98%. Коробка и кабель в комплекте.",
      price: 74900,
      category: "Смартфоны",
      stock: 3,
      status: "active",
      visual: "phone",
    },
    {
      id: "p2",
      name: "MacBook Air M2, 13″",
      description:
        "8 ГБ RAM, SSD 256 ГБ, цвет Midnight. Полный комплект, без повреждений.",
      price: 82900,
      category: "Ноутбуки",
      stock: 2,
      status: "active",
      visual: "laptop",
    },
    {
      id: "p3",
      name: "Sony WH-1000XM5",
      description:
        "Беспроводные наушники с шумоподавлением. Чёрный цвет, чехол и кабель в комплекте.",
      price: 24900,
      category: "Аудио",
      stock: 5,
      status: "active",
      visual: "headphones",
    },
    {
      id: "p4",
      name: "Fujifilm X100V",
      description:
        "Компактная камера, объектив 23 мм. Серебристый корпус, пробег 2 400 кадров.",
      price: 139000,
      category: "Фотоаппараты",
      stock: 0,
      status: "draft",
      visual: "camera",
    },
  ],
  conversations: [
    {
      id: "c1",
      name: "Александр",
      productId: "p1",
      unread: 2,
      human: false,
      messages: [
        {
          id: "m1",
          role: "buyer",
          text: "Здравствуйте! iPhone ещё в продаже?",
          time: "10:24",
        },
        {
          id: "m2",
          role: "seller",
          text: "Здравствуйте! Да, в наличии. Что хотели бы уточнить?",
          time: "10:25",
        },
        {
          id: "m3",
          role: "buyer",
          text: "Подскажите, какое состояние аккумулятора? И что в комплекте?",
          time: "10:28",
        },
      ],
    },
    {
      id: "c2",
      name: "Мария",
      productId: "p2",
      unread: 1,
      human: true,
      messages: [
        {
          id: "m4",
          role: "buyer",
          text: "Добрый день! Можно посмотреть ноутбук сегодня? И будет ли скидка при самовывозе?",
          time: "09:52",
        },
      ],
    },
    {
      id: "c3",
      name: "Дмитрий",
      productId: "p3",
      unread: 0,
      human: false,
      messages: [
        {
          id: "m5",
          role: "buyer",
          text: "Здравствуйте. Наушники есть в наличии?",
          time: "09:15",
        },
        {
          id: "m6",
          role: "seller",
          text: "Здравствуйте! Да, есть 5 штук. Чёрный цвет.",
          time: "09:18",
        },
      ],
    },
    {
      id: "c4",
      name: "Анна",
      productId: "p4",
      unread: 0,
      human: true,
      messages: [
        {
          id: "m7",
          role: "buyer",
          text: "Когда камера снова появится в наличии?",
          time: "Вчера",
        },
      ],
    },
  ],
};
export const money = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
